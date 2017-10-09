const os = require("os");
const { Buffer } = require("buffer");
const { Readable, Writable } = require("stream");
const ffmpeg = require("fluent-ffmpeg");
const fetch = require("node-fetch");

const fs = require('fs')
const bodymovin = require('./bodymovin.js')

// bodymovin.loadAnimation()

// console.log('bm', bodymovin)

const Canvas = require("canvas");
const { Image } = Canvas;

const canvas = new Canvas();
canvas.width = 800;
canvas.height = 600;

const context = canvas.getContext('2d');

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()

    function cleanup () {
      image.onload = null
      image.onerror = null
    }

    image.onload = () => { cleanup(); resolve(image) }
    image.onerror = (err) => { cleanup(); reject(err) }

    if (src.startsWith('http://') || src.startsWith('https://')) {
      fetch(src).then(response => response.buffer()).then(data => {
        image.src = data
      })
    } else {
      // Replace file protocol if it exists
      fs.readFile(src.replace('file://', ''), (err, data) => {
        if (err) {
          reject(err);
          return;
        }

        image.src = data
      })
    }
  })
}

function preloadImages(imagePaths) {
  return new Promise(resolve => {
    const loadedImages = {};
    Promise.all(imagePaths.map(loadImage)).then(images => {
      imagePaths.forEach((imagePath, index) => {
        loadedImages[imagePath] = images[index];
      })
      resolve(loadedImages);
    });
  })
}

const animationData = require('./listing.json');

// "assets": [
//   { "id": "image_0", "w": 800, "h": 800, "u": "images/", "p": "/Users/devin_abbott/Desktop/fjords.png" },
//   { "id": "image_1", "w": 800, "h": 800, "u": "images/", "p": "/Users/devin_abbott/Desktop/fjords.png" },
//   { "id": "image_2", "w": 800, "h": 800, "u": "images/", "p": "/Users/devin_abbott/Desktop/fjords.png" },
//   { "id": "image_3", "w": 800, "h": 800, "u": "images/", "p": "/Users/devin_abbott/Desktop/fjords.png" },
// ]
const { assets } = animationData;

const imagePaths = assets ? assets.filter(asset => !!asset.p).map(asset => asset.p) : []

console.log('image paths', imagePaths)

preloadImages(imagePaths).then(loadedImages => {
  console.log('loadedImages', loadedImages)

  const animationItem = bodymovin.loadAnimation({
    // container: element, // the dom element
    renderer: 'canvas',
    loop: false,
    autoplay: false,
    animationData: animationData, // the animation data
    images: loadedImages,
    rendererSettings: {
      context: context, // the canvas context
      // scaleMode: 'noScale',
      clearCanvas: false,
      // progressiveLoad: false, // Boolean, only svg renderer, loads dom elements when needed. Might speed up initialization for large number of elements.
      // hideOnTransparent: true //Boolean, only svg renderer, hides elements when opacity reaches 0 (defaults to true)
    }
  });

  console.log('Total Frames', animationItem.totalFrames)

  function drawFrames(animationItem) {
    const frames = [];

    for (let i = 0; i <= animationItem.totalFrames; i++) {
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);

      animationItem.goToAndStop(i, true);

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
})

