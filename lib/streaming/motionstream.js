/*
    From https://github.com/mmaelzer/motion
*/

var Motion = require('./motion');
var decoder = require('./motion-decode');
var TimedQueue = require('ttq');
var util = require('util');
var stream = require('stream');

function MotionStream(options) {
  options = options || {};

  stream.Readable.call(this);

  this.minimumMotion = options.minimumMotion || 2;

  this.prebuf = (options.prebuffer || 4) + this.minimumMotion;
  this.postbuf = options.postbuffer || 4;

  this.preframes = [];
  this.postframes = [];
  this.nomotion = 0;
  this.foundMotion = 0;

  this.resolution = options.resolution;
  this.interval = options.interval || 1000;

  this.queue = new TimedQueue({
    asyncTest: true,
    interval: this.interval,
    success: this.queueSuccess,
    fail: this.queueFail,
    test: this.queueTest,
    context: this
  });

  this.motion = new Motion({
    threshold: options.threshold,
    minChange: options.minChange
  });

  this.readable = true;
  this.writable = true;
  this.decoder = new decoder();
};
util.inherits(MotionStream, stream.Readable);

/**
 *  TimeTestQueue test callback to determine whether motion was found
 *  in the array of frames 
 *  @param {Array.<Object>} frames
 *  @param {Function(Boolean)} done
 */
MotionStream.prototype.queueTest = function(frames, done) {
  if (!frames || frames.length < 1) {
    process.nextTick(function() { done(false); });
    return;
  }
  var self = this;
  this.decoder.decode((frames[0] || {}).data, function(err, img) {
    if (err) return done(false);
    done(self.motion.detect(img));
  });
};

/**
 *  On TimeTestQueue fail, cache frames as the prebuffer 
 *  @param {Array.<Object>} frames
 */
MotionStream.prototype.queueFail = function(frames) {
  if (this.postBuffering()) {
    frames.forEach(function (frame, index) {
        frame.isLastFrame = (index === frames.length -1);
        this.sendFrame(frame);
    });
  } else {
    this.cacheFrames(frames);
  }
  this.foundMotion = 0;
};

MotionStream.prototype.cacheFrames = function(frames) {
  this.preframes.unshift(frames);
  this.preframes = this.preframes.slice(0, this.prebufferCap());
};

/**
 *  Get the prebuffer size
 *  @return {Number} 
 */
MotionStream.prototype.prebufferCap = function() {
  return Math.max(Math.floor(this.prebuf*1000 / this.interval), 1);
};

/**
 *  On TimeTestQueue success, write frames with any prebuffered frames
 *  @param {Array.<Object>} frames
 */
MotionStream.prototype.queueSuccess = function(frames) {
  if (++this.foundMotion >= this.minimumMotion) {
    this.withPrebuffer(frames).forEach(this.sendFrame, this);
    // clear the frame cache
    this.preframes.length = 0;  
  } else {
    this.cacheFrames(frames);
  }
  this.nomotion = 0;
};

/**
 *  Concat frames onto prebuffer frames
 *  @param {Array.<Object>} frames
 *  @return {Array.<Object>}
 */
MotionStream.prototype.withPrebuffer = function(frames) {
  return [].concat.apply([], this.preframes.slice(0).reverse()).concat(frames);
};

/**
 *  Send frames along
 *  @param {Array.<Object>} frames
 */
MotionStream.prototype.sendFrame = function(frame) {
  this.emit('data', frame);
};

/**
 *  A quick test whether we should write failed frames as a postbuffer
 *  @return {Boolean}
 */
MotionStream.prototype.postBuffering = function() {
  // This test makes sure
  // 1. motion was found
  // 2. our time without motion is less than or equal to the postbuffer time
  return this.foundMotion > 1 
      && (++this.nomotion * this.interval) <= (this.postbuf * 1000);
};

/** 
 *  Take the passed in image and store it in an object with the current time
 *  @param {Buffer} image
 */
MotionStream.prototype.write = function(image) {
  this.queue.push({ data: image, time: Date.now() });
};

MotionStream.prototype.end = function(chunk) {
  this.writable = false;
};

MotionStream.prototype.destroy = function() {
  this.writable = false;
};

MotionStream.prototype._read = function() {

};

module.exports = MotionStream;
