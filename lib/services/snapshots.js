"use strict";

var fs = require('fs');

var cfg = require('../configuration.js');

var streamcore = require('../streaming/core.js');

var conn, logger;

var snapshots = {};

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Snapshots'});

    snapshots = cfg.snapshots.get('snapshots', {});

    conn.on('takeSnapshot', function (command) {
        takeSnapshot.apply(command, command.args);
    });

    conn.on('getSnapshots', function (command) {
        getSnapshots.apply(command, command.args);
    });

    conn.on('getSomeSnapshots', function (command) {
        getSomeSnapshots.apply(command, command.args);
    });

    conn.on('deleteSnapshot', function (command) {
        deleteSnapshot.apply(command, command.args);
    });

    conn.on('getSnapshot', function (command) {
        getSnapshot.apply(command, command.args);
    });
};

function takeSnapshot(cameraid, cb)
{
    streamcore.getImage(cameraid, function (image) {

        if (!image) {

            if (typeof cb === 'function') {
                cb(false);
            }

            return false;
        }

        var dir = cfg.getSnapshotDirectory();

        var snapshotid = require('node-uuid').v4();

        var filename = require('path').join(dir, snapshotid + '.jpeg');

        fs.writeFile(filename, image, function (err) {

            if (err) {

                logger.error(err);

                if (typeof cb === 'function') {
                    cb(false);
                }

                return false;
            }

            snapshots[snapshotid] = {
                cameraid: cameraid,
                datetime: +new Date(),
                filesize: Buffer.byteLength(image)
            };

            cfg.snapshots.set('snapshots', snapshots);

            if (typeof cb === 'function') {
                cb(true);
            }
        });
    });
}

function getSnapshots(cb)
{
    var result = hash_to_array(snapshots);

    if (typeof cb === 'function') {
        cb(result);
    }
}

function getSomeSnapshots(filter, cb)
{
    var result = hash_to_array(snapshots);

    result = result.filter(function (snapshot) {
        return !filter.cameraid || filter.cameraid === snapshot.cameraid;
    }).filter(function (snapshot) {
        return !filter.start || snapshot.datetime >= filter.start;
    }).filter(function (snapshot) {
        return !filter.end || snapshot.datetime <= filter.end;
    });

    if (typeof cb === 'function') {
        cb(result);
    }
}

function deleteSnapshot(snapshotid, cb)
{
    if (!snapshots.hasOwnProperty(snapshotid)) {
        if (typeof cb === 'function') {
            cb(false);
        }
        return;
    }

    delete snapshots[snapshotid];

    cfg.snapshots.set('snapshots', snapshots);

    if (/^[a-f0-9-]+$/.test(snapshotid)) {

        var dir = cfg.getSnapshotDirectory();

        var filename = require('path').join(dir, snapshotid + '.jpeg');

        fs.unlink(filename, function (err) {
            if (err) {
                logger.warn('Failed to delete snapshot at ' + filename, err);
            }
        });

        if (typeof cb === 'function') {
            cb(true);
        }

    } else {

        if (typeof cb === 'function') {
            cb(false);
        }
    }
}

function getSnapshot(snapshotid, cb)
{
    var dir = cfg.getSnapshotDirectory();

    var filename = require('path').join(dir, snapshotid + '.jpeg');

    fs.readFile(filename, function (err, data) {

        if (err) {

            logger.error(err);

            if (typeof cb === 'function') {
                cb(null);
            }

            return false;
        }

        if (typeof cb === 'function') {
            cb(data);
        }
    });
}

function hash_to_array(hash)
{
    var array = [], object;

    for (var key in hash) {

        object = {
            id: key
        };

        for (var key2 in hash[key]) {
            object[key2] = hash[key][key2];
        }

        array.push(object);
    }

    return array;
}

