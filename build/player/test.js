const os = require("os");
const { Buffer } = require("buffer");
const { Readable, Writable } = require("stream");
const ffmpeg = require("fluent-ffmpeg");

const fs = require('fs')
const bodymovin = require('./bodymovin.js')

// bodymovin.loadAnimation()

// console.log('bm', bodymovin)

const Canvas = require("canvas");

const canvas = new Canvas();
canvas.width = 800;
canvas.height = 600;

const context = canvas.getContext('2d');

const animationItem = bodymovin.loadAnimation({
  // container: element, // the dom element
  renderer: 'canvas',
  loop: false,
  autoplay: false,
  animationData: require('./bouncy_mapmaker.json'), // the animation data
  rendererSettings: {
    context: context, // the canvas context
    // scaleMode: 'noScale',
    clearCanvas: false,
    // progressiveLoad: false, // Boolean, only svg renderer, loads dom elements when needed. Might speed up initialization for large number of elements.
    // hideOnTransparent: true //Boolean, only svg renderer, hides elements when opacity reaches 0 (defaults to true)
  }
});

console.log('ai', animationItem.totalFrames)

console.log('writing test.png')
const buffer = canvas.toBuffer()
fs.writeFileSync('test.png', buffer);

// bodymovin.loadAnimation({
//   // container: element, // the dom element
//   renderer: 'canvas',
//   loop: true,
//   autoplay: true,
//   animationData: require('./progression.json'), // the animation data
// });

function drawFrames(animationItem) {
  const frames = [];

  for (let i = 0; i <= animationItem.totalFrames; i++) {
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    // context.clearRect(0, 0, canvas.width, canvas.height);

    animationItem.goToAndStop(i, true);
    animationItem.gotoFrame(i);

    // animationItem.advanceTime(16);
    frames.push(canvas.toBuffer());
  }

  return frames;
}

class FrameStream extends Readable {
  constructor(frames, options) {
    super(options);
    this.frames = frames;
    this.current = 0;
    this.count = frames.length;
  }

  _read() {
    if (this.current >= this.count) {
      console.log("finished reading");

      this.push(null);
      return;
    }

    // console.log("read frame", this.current);

    this.push(this.frames[this.current]);
    this.current += 1;
  }
}

class BufferedStream extends Writable {
  constructor(options) {
    super(options);
    this.buffers = [];
    this.on("finish", () => {
      const data = Buffer.concat(this.buffers);
      this.emit("buffered", data);
    });
  }

  _write(chunk, encoding, callback) {
    this.buffers.push(chunk);
    callback();
  }
}

function writeVideo(frames) {
  const frameStream = new FrameStream(frames);

  console.log("frame stream", !!frameStream);

  return new Promise(resolve => {
    const outputStream = new BufferedStream();

    outputStream.on("buffered", buffer => {
      console.log("output ready");
      resolve(buffer);
    });

    ffmpeg()
      .input(frameStream)
      // .inputOptions(["-r 30", "-f image2pipe"])
      .inputOptions(["-r 30"])
      .format("mp4")
      .videoCodec("libx264")
      .on("end", function() {
        console.log("finished writing video");
      })
      .on("error", function(err) {
        // callback(err);
        console.log("an error happened: " + err.message);
      })
      .outputOptions(["-movflags frag_keyframe+empty_moov"])
      .output(outputStream, { end: true })
      .run();
  });
}

const frames = drawFrames(animationItem);
writeVideo(frames).then(buffer => {
  fs.writeFileSync('test.mp4', buffer);
  process.exit(0);
})