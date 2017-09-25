const Jimp = require('jimp');
const fs = require('fs');
const {imageToWheel, wheelToImage, wheelToText, wheelToRaw} = require('../src/tools');
// const ledSize = 5;
// const ledMargin = 2;

// const start = 10;
// const length = 37;

const [node, bin, source, start, length, def, base] = process.argv;

Jimp.read(source).then(function (input) {
    const result = imageToWheel(input.cover(80, 80).contrast(0.5), parseInt(start), parseInt(length), parseInt(def), parseInt(base), false);
    const result2 = imageToWheel(input.cover(80, 80).contrast(0.5), parseInt(start), parseInt(length), parseInt(def), parseInt(base), true);
    input.cover(80, 80).write('/Users/juliensanchez/Desktop/DSC_5834_0.png');
    const raw = wheelToRaw(result, parseInt(start), parseInt(def), parseInt(base));

    const wstream = fs.createWriteStream('/Users/juliensanchez/Documents/Arduino/led/data/data');
    wstream.write(raw);
    wstream.end();

    var sample = 1;
    var size = (parseInt(start) + parseInt(length)) * 2 * sample;
    var image = new Jimp(
        size,
        size,
        0x000000FF
    );
    wheelToImage(image, result2, parseInt(start), parseInt(length), 1, parseInt(def), parseInt(base), Jimp.rgbaToInt).write('/Users/juliensanchez/Desktop/DSC_5834_1.png');

    sample = 2;
    size = (parseInt(start) + parseInt(length)) * 2 * sample;
    image = new Jimp(
        size,
        size,
        0x000000FF
    );
    wheelToImage(image, result2, parseInt(start), parseInt(length), 2, parseInt(def), parseInt(base), Jimp.rgbaToInt).write('/Users/juliensanchez/Desktop/DSC_5834_2.png');
}).catch(function (err) {
    console.error(err);
});
