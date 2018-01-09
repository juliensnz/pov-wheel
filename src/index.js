import { imageToWheel, wheelToImage, wheelToRaw } from './tools';

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
};


const progressUpdater = (canvasElement, wheelElement, size, sample) => (progress) => {
    wheelElement.style.animationName = progress < 1 ? 'spin' : '';
    canvasElement.style.webkitMask = `url("data:image/svg+xml;utf8,<?xml version='1.0' encoding='UTF-8' standalone='no'?><!DOCTYPE svg PUBLIC '-//W3C//DTD SVG 1.1//EN' 'http://www.w-3.org/Graphics/SVG/1.1/DTD/svg11.dtd'><svg xmlns='http://www.w3.org/2000/svg' version='1.1' width='${size*sample}px' height='${size*sample}px'><circle cx='${size}' cy='${size}' r='${Math.round(progress*size)}' stroke='white' stroke-width='2' fill='white' /></svg>")`;
}

const createCanvas = (size) => (imageData = null) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (null !== imageData) {
        ctx.putImageData(imageData, 0, 0);
    }

    return canvas;
};

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
    const canvasSize = Math.min(image.height, image.width);

    var canvas = document.createElement('canvas');
    canvas.height = size;
    canvas.width = size;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(image,
        0, 0, canvasSize, canvasSize,
        0, 0, size, size,
    );
    ctx.rotate(90 * Math.PI / 180);

    return new ProcessableImage(ctx.getImageData(0, 0, image.width, image.height));
}

const getImageOrientation = (file, callback) => {
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

        http.onreadystatechange = function() {
            if (http.readyState == 4 && http.status == 200) {
                resolve(http.responseText);
            }
        }

        http.send();
    });
}

const sendAngle = (url, angles, angle, step, notify) => {
    const slice = angles.slice(0, step);
    notify(angle);
    if (0 === slice.length) {
        return;
    }

    return postData(url, slice).then((response) => {
        return sendAngle(url, angles.slice(step), ++angle, step, notify);
    });
}

const contrastImage = (processableImage, contrast) => {  // contrast as an integer percent
    var data = processableImage.getImageData().data;  // original array modified, but canvas not updated
    contrast *= 2.55; // or *= 255 / 100; scale integer percent to full range
    var factor = (255 + contrast) / (255.01 - contrast);  //add .1 to avoid /0 error

    for (var i = 0;i < data.length;i += 4) {
        data[i] = factor * (data[i] - 128) + 128;     //r value
        data[i + 1] = factor * (data[i + 1] - 128) + 128; //g value
        data[i + 2] = factor * (data[i + 2] - 128) + 128; //b value

    }
    return processableImage;  //optional (e.g. for filter function chaining)
}

document.addEventListener('touchmove', function (event) {
  if (event.scale !== 1) { event.preventDefault(); }
}, false);

const uploadToWheel = (url, wheelData, updateProgress) => {
    updateProgress(0);

    const step = 36*2*3;
    const full = wheelData.length / step;

    const notify = (updater) => (progress) => {
        updater(progress/full);
    }

    postData(`${url}/open`).then((response) => {
        sendAngle(`${url}/upload`, wheelData, 0, step, notify(updateProgress)).then(() => {
            postData(`${url}/close`);
            updateProgress(1);
        });
    });
}

const handleNewImage = (file) => {
    getImageOrientation(file, function(orientation) {
        //alert('orientation: ' + orientation);
    });

    readFile(file).then((image) => {
        const start = 10;
        const length = 36;
        const def = 1;
        const sample = 2;
        const size = (start + length) * 2;

        const createSquareCanvas = createCanvas(size * sample);

        const processableImage = getDataFromImage(image, size);
        const contrastedImage = contrastImage(processableImage, 30);

        const wheelData = imageToWheel(
            contrastedImage,
            start,
            length,
            def,
            false
        );

        const rawWheelData = wheelToRaw(wheelData, start, def);
        const previewImage = wheelToImage(
            new ProcessableImage(
                createSquareCanvas().getContext('2d').getImageData(0, 0, size * sample, size * sample)
            ),
            wheelData,
            start,
            length,
            2,
            def,
            rgbaToInt
        );


        const resultElement = document.getElementById('result');
        const wheelElement  = document.getElementById('wheel_image');
        resultElement.innerHTML = '';
        const canvas = createSquareCanvas(previewImage.getImageData());
        resultElement.appendChild(canvas);

        const updateProgress = progressUpdater(resultElement, wheelElement, size, sample);

        uploadToWheel('http://192.168.4.1', rawWheelData, updateProgress);
    });
};


document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('file').onchange = (event) => {
        handleNewImage(event.currentTarget.files[0]);
    };
});
