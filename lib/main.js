"use strict";

var cfg = require('./configuration.js');

var log;

module.exports = function () {

    var options = require('commander');
    var glob = require('glob');
    var path = require('path');

    options
      .version(require('../package.json').version)
      .option('-l, --loglevel [level]', 'Log level (fatal, error, warn, info, debug, trace) [info]', 'info')
      .option('--nocolor', 'Disable colors in terminal output', false)
      .option('--pidfile [path]', 'Save a pid file at the given path', '')
      .option('--platform [platform]', 'Set platform', '')
      .option('--autostart', 'Run in tray (nwjs only)', '')
      .option('--claim', 'Claim server manually (interactive)', false)
      .parse(process.argv);

    log = require('./logger.js')(options, process.stdout);

    if (options.pidfile) {

        var fs = require('fs');

        fs.writeFile(options.pidfile, process.pid, function (err) {
            if (err) {
                log.error('Failed to write pidfile: ' + err);
            }
        });
    }

    log.debug('Loading configuration');

    cfg.load(log, function (serverid, uuid) {

        if (options.claim) {
            claimServer();
            return;
        }

        var conn = require('./connection.js')(log, serverid, uuid);

        require('es6-promise').polyfill();

        log.debug('Loading modules');

        require('./streaming/core.js')(log);

        glob("./{services,devices}/*.js", { cwd: __dirname }, function (err, files) {

            if (err) {
                log.error(err);
            }

            var blacklist = cfg.get('blacklist_modules', []);

            files.filter(function (file) {
                return blacklist.indexOf(path.basename(file, '.js')) === -1;
            }).forEach(function (file) {
                require(file)(conn, log);
            });

            log.info('Connecting...');

            conn.connect();
        });
    });
};

function claimServer()
{
    var read = require('read');

    read({
        prompt: 'Email: '
    }, function (err, email) {

        if (err) {
            log.debug(err);
            return;
        }

        read({
            prompt: 'Password: ',
            silent: true,
            replace: '*'
        }, function (err, password) {

            if (err) {
                log.debug(err);
                return;
            }

            claimServerAPI(email, password);
        });
    });
}

function claimServerAPI (email, password)
{
    var get = require('simple-get');
    var querystring = require('querystring');

    var url = 'https://nhome.ba/api/auto_claim_server';

    var postdata = querystring.stringify({
        id: cfg.get('serverid'),
        email: email,
        pass: password
    });

    var params = {
        url: url,
        body: postdata,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postdata)
        }
    };

    get.concat(params, function (err, res, body) {

        if (err) {
            log.error('Claim error', err);
            return;
        }

        if (res.statusCode !== 200) {
            log.error('Claim error', res.statusCode);
            return;
        }

        var response = JSON.parse(body);

        if (response) {
            log.info('Success');
        } else {
            log.error('Failed');
        }
    });
}

