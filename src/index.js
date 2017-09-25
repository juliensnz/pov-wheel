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

const blackImg = (width, height, sample) => {
    var canvas = document.createElement('canvas');
    canvas.width = width * sample;
    canvas.height = height * sample;
    var ctx = canvas.getContext('2d');
    ctx.rect(0, 0, width * sample, height * sample);
    ctx.fillStyle = 'black';
    ctx.fill();

    return ctx;
}

const imageToCanvas = (imageData) => {
    var canvas = document.createElement('canvas');
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

const sendAngle = (angles, angle, step) => {
    const slice = angles.slice(0, step);
    if (0 === slice.length) {
        return;
    }

    return postData('http://192.168.4.1/upload', slice).then((response) => {
        return sendAngle(angles.slice(step), ++angle, step);
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

            const step = 36*2*3;

            postData('http://192.168.4.1/open').then((response) => {
                sendAngle(raw, 0, step).then(() => {
                    postData('http://192.168.4.1/close')
                });
            });

            console.log(raw.length);

            const imageResult2      = imageToWheel(
                contrastedImage,
                start,
                length,
                def,
                base
            );

            const renderedImage = wheelToImage(
                new ProcessableImage(
                    blackImg(image.width, image.height, 2)
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

            document.getElementById('result').appendChild(imageToCanvas(renderedImage.getImageData()));
        });
    };
});
