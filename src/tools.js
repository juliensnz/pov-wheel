
// const ledSize = 5;
// const ledMargin = 2;

// const start = 10;
// const length = 37;

const baseColor = 8;

const combine = (base, r, g, b) => {
    return (r << (base*2)) | (g << base) | b;
}

const uncombine = (base, combined) => {
    return {
        r: combined >> (base*2),
        g: (combined >> base) % Math.pow(2, base),
        b: combined % Math.pow(2, base)
    }
}

module.exports.imageToWheel = (image, start, length, def, base, combineColors = true) => {
    const size = (start + length) * 2;
    let result = [];
    const center = {
        x: start + length,
        y: start + length
    };
    for (let angle = 0; angle < 360; angle += def) {
        result[angle/def] = [];
        for(var i = 0; i < start; i++) {
            result[angle/def].push(null);
        }
        for (let distance = start; distance < start + length; distance += 1) {
            const sample = {
                x: Math.round(Math.cos(angle * Math.PI / 180) * distance + center.x),
                y: Math.round(Math.sin(angle * Math.PI / 180) * distance + center.y),
            };
            const idx = image.getPixelIndex(sample.x, sample.y);
            const multiplier = Math.pow(2, baseColor - base);
            var red   = Math.floor(image.bitmap.data[idx + 0]/multiplier);
            var green = Math.floor(image.bitmap.data[idx + 1]/multiplier);
            var blue  = Math.floor(image.bitmap.data[idx + 2]/multiplier);

            if (combineColors) {
                result[angle/def][distance] = combine(base, red, green, blue);
            } else {
                result[angle/def][distance] = [red, green, blue];
            }
        }
    }

    return result;
}

module.exports.wheelToImage = (image, wheel, start, length, sample, def, base, rgbaToInt) => {
    const size = (start + length) * 2 * sample;
    const center = {
        x: size/2,
        y: size/2
    }

    for (let angle in wheel) {
        angle = parseInt(angle);

        const colors = wheel[angle];
        for (let distance in colors) {
            const point = {
                x: Math.floor(sample * distance * Math.cos(angle*def*Math.PI/180) + center.x),
                y: Math.floor(sample * distance * Math.sin(angle*def*Math.PI/180) + center.y)
            };
            const baseColors = uncombine(base, colors[distance]);
            const multiplier = Math.pow(2, baseColor - base);

            image.setPixelColor(
                rgbaToInt(baseColors.r * multiplier, baseColors.g * multiplier, baseColors.b * multiplier, 255),
                point.x,
                point.y
            );
        }
    }

    return image;
}

module.exports.wheelToText = (wheel, start, def, base, combineColors = true) => {
    const result = wheel.filter((item) => null !== item)
        .map((distances, angle) => {
            const line = distances
                .filter((color, distance) => start <= distance)
                .map((colors) => {
                    if (combineColors) {
                        return colors;
                    }

                    return `{${colors.join(',')}}`;
                })
                .join(',');

            return `{${line}}`;
        }).join(',');

    return `const int base = ${base};
const int def = ${def};
const int mult = ${Math.pow(2, baseColor - base)};
const int image[${360/def}][${wheel[0].length-start}] = {${result}};`;
};


module.exports.wheelToRaw = (wheel, start, def, base) => {
    const step = wheel.length / 4;
    let splitWheel = [];
    for (let i = 0; i < wheel.length; i++) {
        splitWheel.push(wheel[i]);
        splitWheel.push(wheel[(i + step) % 360]);
        splitWheel.push(wheel[(i + 2 * step) % 360]);
        splitWheel.push(wheel[(i + 3 * step) % 360]);
    }

    const result = splitWheel
        .map(distances => distances.filter(item => item !== null))
        .reduce((result, distances) => {
            const combinedDistances = distances.reduce((result, colors) => [...result, ...colors], []);

            return [...result, ...combinedDistances]
        },[]);

    var buffer = new ArrayBuffer(result.length);
    var intBuffer = new Uint8Array(buffer);

    for (var i = 0; i < result.length; i++) {
      intBuffer[i] = result[i];
    }

    return intBuffer;
};
