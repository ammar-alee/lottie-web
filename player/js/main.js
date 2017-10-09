// global.requestAnimationFrame = require('raf')


// (function() {
//   let elapsed = 0;

//   global.requestAnimationFrame = function (f) {
//     console.log('raf', elapsed, arguments);

//     elapsed += 16;

//     f(elapsed);
//   }
// })()

// require('raf').polyfill()

requestAnimationFrame = () => {}

if (typeof navigator === 'undefined') {
  navigator = {
    userAgent: 'node',
  }
}

if (typeof document === 'undefined') {
  const Canvas = require("canvas");

  document = {
    createElement: function(type) {
      console.log('create element', type)
      switch (type.toLowerCase()) {
        case 'canvas':
          // console.log('create canvas')
          const canvas = new Canvas();

          // setTimeout(() => {
          //   console.log('canvas', canvas.width, canvas.height)
          // }, 2000)

          return canvas;
        default:
          return {};
      }
    },
  }
}

var svgNS = "http://www.w3.org/2000/svg";

var locationHref = '';
