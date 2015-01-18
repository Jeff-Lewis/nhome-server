
var conn;

var request = require('request');

function log(msg)
{
    console.log('[MJPEG]', msg);
}

module.exports = function(c) {

    conn = c;

    conn.on('makeMJPEG', function (camera) {
        makeMJPEG(camera);
    });
}

function makeMJPEG(camera)
{
    log('Creating MJPEG stream from ' + camera.url);

    require('tls').connect({host: 'nhome.ba', port: 8082}, function() {

        this.setNoDelay();

        this.write(camera.id);
    
        this.write("HTTP/1.1 200 OK\r\n");
        this.write("Content-Type: multipart/x-mixed-replace; boundary=myboundary\r\n");
        this.write("Cache-Control: no-cache\r\n");
        this.write("Connection: close\r\n");
        this.write("Pragma: no-cache\r\n");
        this.write("\r\n");

        updateSnapshot(camera, this);
    
        this.on('close', function() {
            log('Completed');
        });
    });
}

function updateSnapshot(camera, res)
{
    var timer, options = {encoding: null, auth: camera.auth};

    var refresh = function () {

        request(camera.url, options, function (error, response, body) {
            if (!error && response.statusCode == 200) {

                timer = setTimeout(refresh, 1000);
    
                res.write("--myboundary\r\n");
                res.write("Content-Type: image/jpeg\r\n");
                res.write("Content-Length: " + body.length + "\r\n");
                res.write("\r\n");
                res.write(body, 'binary');
                res.write("\r\n");

            } else {
                log(response.statusCode);
                log(error);
            }
        });
    };
    
    res.on('close', function() {
        clearTimeout(timer);
    });

    refresh();
}