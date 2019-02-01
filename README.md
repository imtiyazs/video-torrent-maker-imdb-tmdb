Video Torrent Creator Application developed in NodeJS using TMDB API's and OMDB NPM Module.

** The project is developed and made open source for learning purpose. **

Creates a torrent package of video file that will include: 
- video file (mp4, avi, mpeg, mov etc)
- info.json (Information of video or movie fetched from IMDB or TMDB as per parameters passed)
- 3 screenshots from actual video
- 1 official IMDB or TMDB poster
- .SRT (Sub title files) if found any

All the files will be packaged into one torrent file with best seeders and trackers online right now.

Usage (Development):
1. git clone https://github.com/imtiyazs/NodeTorrentCreatorWithIMDBInformation.git
2. cd NodeTorrentCreatorWithIMDBInformation
3. npm install
4. npm start "./directory_path_to_video_files" "imdb OR tmdb" 

Command for TMDB: npm start "./directory_path_to_video_files" "tmdb"   OR  npm start "./directory_path_to_video_files"
Command for IMDB: npm start "./directory_path_to_video_files" "imdb"


Usage (Executables):
main-win.exe "./directory_path_to_video_files" "imdb OR tmdb"

NOTE:
- FFMPEG is required to extract screenshots from video file.
- Make sure to run with sudo or adminitrator privileges

Credits:
- To all the contributers of npm module creators, TMDB, OMDB for providing such an amazing modules and helping the community.
