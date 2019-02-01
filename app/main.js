const createTorrent = require('create-torrent'),
    imdb = require('imdb-api'),
    constant = require('./constant'),
    fs = require('fs'),
    path = require('path'),
    request = require('request'),
    ffmpeg = require('fluent-ffmpeg')

/** Set FFMPEG EXE PATH */
switch (process.platform) {
    case 'win32':
        ffmpeg.setFfmpegPath('./ffmpeg/win/ffmpeg.exe')
        ffmpeg.setFfprobePath('./ffmpeg/win/ffprobe.exe')
        break

    case 'linux':
        ffmpeg.setFfmpegPath('./ffmpeg/linux/ffmpeg')
        ffmpeg.setFfprobePath('./ffmpeg/linux/ffprobe')
        break

    case 'darwin':
        ffmpeg.setFfmpegPath('./ffmpeg/mac/ffmpeg')
        ffmpeg.setFfprobePath('./ffmpeg/mac/ffprobe')
        break
}

let DirPath = './',
    MovieFolders = [],
    BatchInformation = []

if (process.argv.length > 3) {

    console.log('Executable parameters exceeded. Allowed only one parameter.')
    console.log('program.exe "<dir_path>"')

    setTimeout(() => {
        process.exit(1)
    }, 5000)

} else {

    if (process.argv[2] !== undefined && process.argv[2] !== null && process.argv[2] !== 'undefined' && process.argv[2] !== 'null') {
        DirPath = process.argv[2]
    }

    if (DirPath == undefined) {
        console.log('Undefined directory path')
        process.exit()
    }

    console.log('Starting Torrent Creator.')
    ReadFilesFromFolder()
        .then(() => {
            console.log('Processing Files...')
            setTimeout(() => {
                require('co')(function* () {
                    for (let i in MovieFolders) {
                        let fileObj = MovieFolders[i]
                        console.log('-----------' + fileObj.folderName + '------------')
                        let screenshotsArray = []
                        screenshotsArray = yield ExtractScreenshotsFromVideo(fileObj.folderPath, fileObj.fileName)
                        let arrayOfNames = yield ConstructMovieName(fileObj.folderName)
                        console.log('Searching Movie on IMDB API...')
                        require('co')(function* () {
                            for (let i in arrayOfNames) {
                                let information = yield GetIMDBInformation(arrayOfNames[i])
                                if (information != null) {
                                    console.log('Requesting For Movie Thumbnail and Image...')
                                    request.get(information.poster, {
                                        encoding: 'binary'
                                    }, (error, response, body) => {
                                        if (error) {
                                            console.log('Cannot fetch thumbnail: ' + error)
                                        } else {
                                            fs.writeFile(path.join(fileObj.folderPath, 'poster.jpg'), body, 'binary', (err) => {
                                                if (err) {
                                                    console.log('Cannot write thumbnail: ' + error)
                                                }
                                            })
                                        }

                                        // New Update of HLS URL added to info.json
                                        information['HLSUrl'] = 'http://sample.com/' + fileObj.folderName + '/playlist.m3u8'

                                        fs.writeFile(path.join(fileObj.folderPath, 'info.json'), JSON.stringify(information), (err) => {
                                            if (err) {
                                                console.log('Skipping Information File: ' + err)
                                            }
                                        })

                                        console.log('Creating Torrent File...')
                                        console.log('NOTE: TORRENT CREATION SPEED DEPENDS UPON SIZE OF FILE. PLEASE HAVE PATIENCE FOR LARGE FILE SIZE.')
                                        createTorrent(fileObj.folderPath, function (err, torrent) {
                                            if (err) {
                                                console.log('Skipping File: Error creating torrent files: ' + err)
                                            } else {
                                                fs.writeFile(path.join(DirPath, fileObj.folderName + '.torrent'), torrent, (err) => {
                                                    if (err) {
                                                        console.log('Skipping File: Cannot Write Torrent File: ' + err)
                                                    } else {

                                                        BatchInformation.push({
                                                            torrentName: fileObj.folderName + '.torrent',
                                                            torrentDirectory: fileObj.folderName,
                                                            torrentImage: path.join(fileObj.folderPath, 'poster.jpg'),
                                                            torrentSRT: fileObj.srtFile,
                                                            torrentScreenshots: screenshotsArray,
                                                            IMDBInfoFile: path.join(fileObj.folderPath, 'info.json'),
                                                            RawIMDBInformation: JSON.stringify(information)
                                                        })

                                                        console.log(fileObj.folderName + ' Torrent Created Successfully...')
                                                    }
                                                })
                                            }
                                        })
                                    })

                                    break
                                }
                            }
                        })
                    }
                })
            }, 5000);
        })
}

process.on('beforeExit', () => {
    if (BatchInformation.length != 0) {
        fs.writeFile(path.join(DirPath, 'batch-info.json'), JSON.stringify(BatchInformation), (error) => {
            if (error) {
                console.log('Cannot Write Batch Information File: ' + error)
            }

            console.log('Batch Information File Created Successfully')
            console.log('Exiting Application')
            process.exit()
        })
    }

    if (MovieFolders.length == 0) {
        console.log('No Movie Files Found. Exiting Application.')
        process.exit()
    }
})

/**
 * Creates a set of possible movie names from filename provided
 * @param {*} movieName String  
 */
function ConstructMovieName(movieName) {
    return new Promise((resolve) => {
        console.log('Extracting Movie Name For IMDB Search...')
        let Name = movieName.replace(/\./g, ' ');
        let splitName = Name.split(' '),
            arrayOfNames = [],
            lastWord = ''

        splitName.forEach((word, i) => {
            arrayOfNames.push(lastWord + word)
            lastWord += word + ' '
        })

        resolve(arrayOfNames.reverse())
    })
}

/**
 * Read files from current directory and moves them to independent directory
 * along with SRT file if available
 */
function ReadFilesFromFolder() {
    return new Promise((resolve) => {
        console.log('Reading Files From Current Directory')
        fs.readdir(DirPath, (err, files) => {
            if (err) {
                console.log('Exiting: Error Reading Files: ' + err)
                process.exit(1)
            }

            files.forEach(file => {
                let folderName = file.substr(0, file.lastIndexOf('.'))
                if (path.extname(file) === '.mp4' || path.extname(file) === '.mov' || path.extname(file) === '.mkv' || path.extname(file) === '.avi' || path.extname(file) === '.m4v' || path.extname(file) === '.webp' || path.extname(file) === '.mov' || path.extname(file) === '.mpg') {
                    let newFilePath = path.join(DirPath, folderName)
                    fs.mkdir(newFilePath, (err) => {
                        if (err) {
                            console.log('Skipping File: ' + file + '. Cannot create directory. Error: ' + err)
                        } else {

                            let SRTFile = ''
                            fs.exists(path.join(DirPath, folderName + '.srt'), (exists) => {
                                if (exists) {
                                    SRTFile = folderName + '.srt'
                                    fs.rename(path.join(DirPath, folderName + '.srt'), path.join(newFilePath, folderName + '.srt'), (err) => {
                                        if (err) {
                                            console.log('Skipping SRT File: ' + folderName + '.srt' + '. Cannot move to directory. Error: ' + err)
                                        }
                                    })
                                }

                                fs.rename(path.join(DirPath, file), path.join(newFilePath, file), (err) => {
                                    if (err) {
                                        console.log('Skipping File: ' + file + '. Cannot move to directory. Error: ' + err)
                                    } else {
                                        MovieFolders.push({
                                            fileName: file,
                                            folderPath: newFilePath,
                                            folderName: folderName,
                                            srtFile: SRTFile
                                        })
                                    }
                                })
                            })

                        }
                    })
                }
            })

            resolve()
        })
    })
}

/**
 * Get movie information from OMDB API
 * @param {*} movieName String
 */
function GetIMDBInformation(movieName) {
    return new Promise((resolve) => {
        imdb.get({
            name: movieName
        }, {
            apiKey: constant.OMDB_APIKEY,
            timeout: 30000
        }).then(information => {
            if (information.title != undefined || information.title !== null) {
                resolve(information)
            } else {
                resolve(null)
            }
        }).catch(err => {
            resolve(null)
        });
    })
}

/**
 * Capture screenshots
 */
function ExtractScreenshotsFromVideo(movieDir, movieName) {
    return new Promise((resolve) => {
        console.log('Extracting Screenshots from Movie: ' + movieName)
        console.log('THIS PROCESS WILL A TAKE LONG TIME SINCE WE ARE RENDERING YOUR MOVIE AND CAPTURING BEST OF IT.')
        ffmpeg(path.join(movieDir, movieName))
            .screenshots({
                count: 3,
                filename: 'screenshot-%s-seconds.png',
                folder: movieDir
            })
            .on('end', function () {
                fs.readdir(movieDir, (err, files) => {
                    if (err) {
                        console.log("Cannot Read ExtractScreenshotsFromVideo Directory")
                        return resolve()
                    } else {
                        let screenshotArray = []
                        files.forEach(file => {
                            if (file.includes('screenshot-')) {
                                screenshotArray.push(path.join(movieDir, file))
                            }
                        })
                        return resolve(screenshotArray)
                    }
                })
            })
    })
}