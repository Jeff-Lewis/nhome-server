"use strict";

var Itach = require('simple-itach');

var Namer = require('../services/namer.js');
var Cats = require('../services/cats.js');

var conn;

var devices = {};

var remotes = {};

var logger;

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'iTach'});

    var cfg = require('../configuration.js');
    remotes = cfg.get('itach_remotes', {});

    var d = new Itach.discovery();

    d.on('device', function(device) {

        if (!devices.hasOwnProperty(device.UUID)) {

            log('Discovered device');

            devices[device.UUID] = {
                name: device.Model,
                dev: new Itach(device.host)
            };

            Namer.add(devices);
        }
    });

    d.once('device', function() {
        startListening();
    });
};

function startListening()
{
    log('Ready for commands');

    conn.on('getBridges', function(cb) {
        sendBridgeInfo(cb);
    });

    conn.on('getRemotes', function (cb) {
        getRemotes(cb);
    });

    conn.on('sendRemoteCommand', function (id, cmd, cb) {
        sendRawCommand(id, cmd, cb);
    });

    conn.on('sendKey', function (remoteid, key, cb) {
        sendKey(remoteid, key, cb);
    });

    conn.on('learnKey', function (remoteid, key) {
        learnKey(remoteid, key);
    });

    conn.on('saveCustomRemote', function (remote) {
        saveCustomRemote(remote);
    });

    conn.on('deleteCustomRemote', function (remoteid) {
        deleteCustomRemote(remoteid);
    });

    conn.on('updateCustomRemote', function (remote) {
        updateCustomRemote(remote);
    });

    conn.on('getCustomRemotes', function (cb) {
        getCustomRemotes(cb);
    });
}

function sendBridgeInfo(cb)
{
    var bridgeInfo = [];

    for (var device in devices) {
        bridgeInfo.push({ name: Namer.getName(device), id: device });
    }

    conn.broadcast('bridgeInfo', bridgeInfo);

    if (cb) cb(bridgeInfo);
}

function getRemotes(cb)
{
    var r = [];

    for (var device in devices) {
        r.push({
            id: device,
            name: Namer.getName(device)
        });
    }

    conn.broadcast('remotes', r);

    if (cb) cb(r);
}

function sendRawCommand(id, cmd, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb([]);
        return;
    }

    devices[id].dev.send(cmd, function (err, res) {
        if (err) {
            log(err);
            if (cb) cb(false);
            return;
        }
        if (cb) cb(true);
    });
}

function sendKey(remoteid, key, cb)
{
    var remote = remotes[remoteid];

    if (!remote) {
        log('Unknown remote "' + remoteid + '"');
        if (cb) cb(false);
        return;
    }

    if (!remote.keys.hasOwnProperty(key)) {
        log('Unknown key "' + key + '"');
        if (cb) cb(false);
        return;
    }

    var cmd = remote.keys[key].replace('1:1', remote.connector);

    sendRawCommand(remote.deviceid, cmd + '\r', cb);
}

function learnKey(remoteid, key)
{
    var remote = remotes[remoteid];

    if (!remote) {
        log('Unknown remote "' + remoteid + '"');
        return;
    }

    devices[remote.deviceid].dev.learn(function (err, res) {

        if (err) {
            log('Learn error: ' + err);
            return;
        }

        saveCode(remoteid, key, res);

        conn.broadcast('IRKeyLearned', { remoteid: remoteid, key: key });
    });
}

function saveCode(remoteid, key, code)
{
    remotes[remoteid].keys[key] = code;

    saveRemotes();
}

function saveRemotes()
{
    require('../configuration.js').set('itach_remotes', remotes);
}

function saveCustomRemote(r)
{
    r.keys = {};
    r.id = require('node-uuid').v4();

    remotes[r.id] = r;

    saveRemotes();

    conn.broadcast('customRemoteAdded', r);
}

function updateCustomRemote(r)
{
    if (!remotes.hasOwnProperty(r.id)) {
        return;
    }

    r.keys = remotes[r.id].keys;

    remotes[r.id] = r;

    saveRemotes();

    conn.broadcast('customRemoteUpdated', r);
}

function deleteCustomRemote(id)
{
    delete remotes[id];

    saveRemotes();

    conn.broadcast('customRemoteDeleted', id);
}

function getCustomRemotes(cb)
{
    var customremotes = [];

    for (var r in remotes) {

        var r2 = JSON.parse(JSON.stringify(remotes[r]));

        if (r2.hasOwnProperty('keys')) {
            r2.keys = Object.keys(r2.keys);
        } else {
            r2.keys = [];
        }

        r2.categories = Cats.getCats(r);

        customremotes.push(r2);
    }

    conn.broadcast('customRemotes', customremotes);

    if (cb) cb(customremotes);
}
