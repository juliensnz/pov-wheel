import { imageToWheel, wheelToImage, wheelToText, wheelToRaw } from './tools';

class ProcessableImage {
    constructor(imageData) {
        this.bitmap = imageData;
    }

    getPixelIndex(x, y) {
        return (this.bitmap.width * y + x) * 4;
    }

    setPixelColor(hex, x, y) {
        const value = {
            red: hex >> 24 & 0xFF,
            green: hex >> 16 & 0xFF,
            blue: hex >> 8 & 0xFF,
            alpha: hex & 0xFF
        };
        var idx = this.getPixelIndex(x, y);

        this.bitmap.data[idx] = value.red;
        this.bitmap.data[idx + 1] = value.green;
        this.bitmap.data[idx + 2] = value.blue;
        this.bitmap.data[idx + 3] = value.alpha;
    }

    getImageData() {
        return this.bitmap;
    }
}

const rgbaToInt = function (r, g, b, a) {
    return (r * Math.pow(256, 3)) + (g * Math.pow(256, 2)) + (b * Math.pow(256, 1)) + (a * Math.pow(256, 0));
}

const blankImg = (width, height, sample) => {
    var canvas = document.createElement('canvas');
    canvas.width = width * sample;
    canvas.height = height * sample;
    var ctx = canvas.getContext('2d');
    // ctx.rect(0, 0, width * sample, height * sample);
    // ctx.fill();

    return ctx;
}

const imageToCanvas = (imageData) => {
    var canvas = document.createElement('canvas');
    canvas.setAttribute('width', 184);
    canvas.setAttribute('height', 184);

    var ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);

    return canvas;
}

const readFile = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const image = document.createElement('img');
            image.onload = () => {
                resolve(image);
            };
            image.src = event.target.result;
        };

        reader.readAsDataURL(file);
    });
}

const getDataFromImage = (image, size) => {
    var canvas = document.createElement('canvas');
    const canvasSize = image.height < image.width ? image.height : image.width;
    canvas.height = size;
    canvas.width = size;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(image,
        0, 0, canvasSize, canvasSize,
        0, 0, size, size,
    );
    ctx.rotate(90*Math.PI/180);

    return new ProcessableImage(ctx.getImageData(0, 0, image.width, image.height));
}

function getOrientation(file, callback) {
  var reader = new FileReader();
  reader.onload = function(e) {

    var view = new DataView(e.target.result);
    if (view.getUint16(0, false) != 0xFFD8) return callback(-2);
    var length = view.byteLength, offset = 2;
    while (offset < length) {
      var marker = view.getUint16(offset, false);
      offset += 2;
      if (marker == 0xFFE1) {
        if (view.getUint32(offset += 2, false) != 0x45786966) return callback(-1);
        var little = view.getUint16(offset += 6, false) == 0x4949;
        offset += view.getUint32(offset + 4, little);
        var tags = view.getUint16(offset, little);
        offset += 2;
        for (var i = 0; i < tags; i++)
          if (view.getUint16(offset + (i * 12), little) == 0x0112)
            return callback(view.getUint16(offset + (i * 12) + 8, little));
      }
      else if ((marker & 0xFF00) != 0xFF00) break;
      else offset += view.getUint16(offset, false);
    }
    return callback(-1);
  };
  reader.readAsArrayBuffer(file);
}

const postData = (url, data) => {
    return new Promise((resolve, reject) => {
        const http = new XMLHttpRequest();
        const appendUrl = data ? ('?' + data
            .reduce((result, value, key) => [...result, `${key}=${value}`], [])
            .join('&')) : '';

        http.open('POST', url + appendUrl, true);
        http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');

        http.onreadystatechange = function() {//Call a function when the state changes.
            if (http.readyState == 4 && http.status == 200) {
                resolve(http.responseText);
            }
        }

        http.send();
    });
}

const sendAngle = (angles, angle, step, notify) => {
    const slice = angles.slice(0, step);
    notify(angle);
    if (0 === slice.length) {
        return;
    }

    return postData('http://192.168.4.1/upload', slice).then((response) => {
        return sendAngle(angles.slice(step), ++angle, step, notify);
    });
}

const contrastImage = (imageData, contrast) => {  // contrast as an integer percent
    var data = imageData.data;  // original array modified, but canvas not updated
    contrast *= 2.55; // or *= 255 / 100; scale integer percent to full range
    var factor = (255 + contrast) / (255.01 - contrast);  //add .1 to avoid /0 error

    for(var i=0;i<data.length;i+=4)  //pixel values in 4-byte blocks (r,g,b,a)
    {
        data[i] = factor * (data[i] - 128) + 128;     //r value
        data[i+1] = factor * (data[i+1] - 128) + 128; //g value
        data[i+2] = factor * (data[i+2] - 128) + 128; //b value

    }
    return imageData;  //optional (e.g. for filter function chaining)
}

document.addEventListener('touchmove', function (event) {
  if (event.scale !== 1) { event.preventDefault(); }
}, false);

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('file').onchange = (event) => {
          getOrientation(event.currentTarget.files[0], function(orientation) {
            //alert('orientation: ' + orientation);
          });
        readFile(event.currentTarget.files[0]).then((image) => {
            const start = 10;
            const length = 36;
            const def = 1;
            const base = 8;

            const processableImage = getDataFromImage(image, (start + length) * 2);
            const contrastedImage = new ProcessableImage(contrastImage(processableImage.getImageData(), 30));
            const imageResult      = imageToWheel(
                contrastedImage,
                start,
                length,
                def,
                base,
                false
            );

            const raw = wheelToRaw(imageResult, start, def, base);

            const imageResult2 = imageToWheel(
                contrastedImage,
                start,
                length,
                def,
                base
            );

            const renderedImage = wheelToImage(
                new ProcessableImage(
                    blankImg(image.width, image.height, 2)
                        .getImageData(0, 0, image.width * 2, image.height * 2)
                ),
                imageResult2,
                start,
                length,
                2,
                def,
                base,
                rgbaToInt
            );


            const updateProgress = (progress) => {
                resultElement.style.webkitMask = `url("data:image/svg+xml;utf8,<?xml version='1.0' encoding='UTF-8' standalone='no'?><!DOCTYPE svg PUBLIC '-//W3C//DTD SVG 1.1//EN' 'http://www.w-3.org/Graphics/SVG/1.1/DTD/svg11.dtd'><svg xmlns='http://www.w3.org/2000/svg' version='1.1' width='184px' height='184px'><circle cx='92' cy='92' r='${Math.round(progress*92)}' stroke='white' stroke-width='2' fill='white' /></svg>")`;
            }

            const resultElement = document.getElementById('result');
            resultElement.innerHTML = '';
            const canvas = imageToCanvas(renderedImage.getImageData())
            resultElement.appendChild(canvas);
            updateProgress(0.1);

            const wheelElement = document.getElementById('wheel_image');
            wheelElement.style.animationName = 'spin';
            const step = 36*2*3;
            const full = raw.length / step;


            const notify = (updater) => (progress) => {
                updater(progress/full);
            }
            postData('http://192.168.4.1/open').then((response) => {
                sendAngle(raw, 0, step, notify(updateProgress)).then(() => {
                    postData('http://192.168.4.1/close');
                    wheelElement.style.animationName = '';
                });
            });
        });
    };
});
