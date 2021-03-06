"use strict";

var conn;

var logger;

var categories, devices;

var cfg = require('../configuration.js');

var Cats = function (c, l) {

    conn = c;
    logger = l.child({component: 'Cats'});

    categories = cfg.get('cats_categories', { generic: { name: 'Generic room' } });
    devices = cfg.get('cats_devices', {});

    conn.on('catAdd', function (command) {
        catAdd.apply(command, command.args);
    });

    conn.on('catDelete', function (command) {
        catDelete.apply(command, command.args);
    });

    conn.on('catUpdate', function (command) {
        catUpdate.apply(command, command.args);
    });

    conn.on('getCategories', function (command) {
        getCategories.apply(command, command.args);
    });

    // Deprecated
    conn.on('catAddDevice', function (command) {
        catAddDevice.apply(command, command.args);
    });

    // Deprecated
    conn.on('catDeleteDevice', function (command) {
        catDeleteDevice.apply(command, command.args);
    });

    conn.on('catSet', function (command) {
        catSet.apply(command, command.args);
    });

    conn.on('catListDevices', function (command) {
        catListDevices.apply(command, command.args);
    });

    conn.on('catOfDevice', function (command) {
        catOfDevice.apply(command, command.args);
    });
};

Cats.getCats = function (deviceid) {

    if (!devices[deviceid]) {
        devices[deviceid] = [];
    }

    return devices[deviceid];
};

Cats.getCat = function (deviceid) {

    if (!devices[deviceid] || devices[deviceid].length === 0) {
        return null;
    }

    return devices[deviceid][0];
};

Cats.save = function() {
    cfg.setMulti({
        'cats_categories': categories,
        'cats_devices': devices
    });
};

function catAdd(cat, cb)
{
    var catid = require('node-uuid').v4();
    categories[catid] = cat;
    Cats.save();

    logger.debug('Category', catid, 'added');

    if (typeof cb === 'function') {
        cb(catid);
    }
}

function catDelete(catid, cb)
{
    delete categories[catid];

    for (var deviceid in devices) {
        removeCatFromDevice(catid, deviceid);
    }

    Cats.save();

    logger.debug('Category', catid, 'deleted');

    if (typeof cb === 'function') {
        cb(true);
    }
}

function catUpdate(catid, cat, cb)
{
    categories[catid] = cat;
    Cats.save();

    logger.debug('Category', catid, 'updated');

    if (typeof cb === 'function') {
        cb(true);
    }
}

function getCategories(cb)
{
    var cat_array = hash_to_array(categories);

    if (typeof cb === 'function') {
        cb(cat_array);
    }
}

function catAddDevice(catid, deviceid, cb)
{
    if (!devices.hasOwnProperty(deviceid)) {
        devices[deviceid] = [];
    }

    if (devices[deviceid].indexOf(catid) === -1) {
        devices[deviceid].push(catid);
        Cats.save();
    }

    if (typeof cb === 'function') {
        cb(true);
    }
}

function catDeleteDevice(catid, deviceid, cb)
{
    if (!devices.hasOwnProperty(deviceid)) {
        devices[deviceid] = [];
    }

    removeCatFromDevice(catid, deviceid);

    Cats.save();

    if (typeof cb === 'function') {
        cb(true);
    }
}

function catSet(catid, deviceid, cb)
{
    devices[deviceid] = [catid];

    Cats.save();

    if (typeof cb === 'function') {
        cb(true);
    }
}

function catListDevices(catid, cb)
{
    var devs = [];

    for (var deviceid in devices) {

        if (Cats.getCats(deviceid).indexOf(catid) !== -1) {
            devs.push(deviceid);
        }
    }

    conn.broadcast('catList', devs);

    if (typeof cb === 'function') {
        cb(devs);
    }
}

function catOfDevice(deviceid, cb)
{
    var cats = Cats.getCats(deviceid);

    conn.broadcast('catOfDevice', cats);

    if (typeof cb === 'function') {
        cb(cats);
    }
}

function removeCatFromDevice(catid, deviceid)
{
    devices[deviceid] = devices[deviceid].filter(function (c) {
        return c !== catid;
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

module.exports = Cats;
