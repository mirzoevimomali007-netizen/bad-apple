const https = require('https');
const fs = require('fs');

const url = "https://archive.org/download/dagobah_Bad_Apple_HQ/Bad_Apple_HQ.mp4";
const dest = "bad_apple.mp4";

function download(url, dest) {
    console.log("Starting download from: " + url);
    const file = fs.createWriteStream(dest);
    
    https.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
            console.log("Redirecting to: " + response.headers.location);
            download(response.headers.location, dest);
            return;
        }
        
        if (response.statusCode !== 200) {
            console.error("Failed to get file. Status code: " + response.statusCode);
            return;
        }

        response.pipe(file);
        
        file.on('finish', () => {
            file.close();
            console.log("Download completed successfully!");
        });
    }).on('error', (err) => {
        fs.unlink(dest, () => {});
        console.error("Error downloading file: " + err.message);
    });
}

download(url, dest);
