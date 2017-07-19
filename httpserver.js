#! /usr/bin/node

var
http = require('http'),
path = require('path'),
util = require('util'),
fs = require('fs');

const
port = 8080,
logPort = 8081,
rootFolder = __dirname + '/public/'
cgiFolder = rootFolder + 'cgi-bin/',
logFolder = rootFolder + 'logs/',
server = http.createServer(requestHandler);
logger = http.createServer(logHandler);

fs.mkdir(logFolder, function (error, folder) {
	if(!error || (error && error.code === 'EEXIST')){
	} else {
		console.log(error);
	}
});

logFile = fs.createWriteStream(logFolder + 'debug.log')

console.log = function () {
  var 
  prepend = colors.fg.Yellow + ' INFO: ' + colors.Reset;
  consoleAll (prepend, arguments);
}

console.error = function () {
  var 
  prepend = colors.fg.Red + '  ERR: ' + colors.Reset;
  consoleAll (prepend, arguments);
}

function consoleAll (prepend, arguments) {
	function time() {
		var now = new Date();
			function AddZero(num, timeType) {
				num = (num >= 0 && num < 10) ? "0" + num : num + "";
				if (timeType === 1) {
					num = (num >= 0 && num < 100) ? "0" + num : num + "";
				};
				return num
			};
		var strDateTime = [[[AddZero(now.getDate()), 
		AddZero(now.getMonth() + 1), 
		now.getFullYear()].join("/"), 
		[AddZero(now.getHours()), 
		AddZero(now.getMinutes())].join(":"),
		AddZero(now.getSeconds())].join(" "),
		AddZero(now.getMilliseconds(),1)].join(".");
	  //currentMs = (currentMs<100) ? "0" + currentMs : currentMs;
		return(strDateTime); 
	};
	var logTime = time()
  process.stdout.write(logTime + prepend);
  var newArg = util.format.apply(util, arguments);
  process.stdout.write(colors.fg.Green  + newArg + colors.Reset + '\n');
  logFile.write(logTime + ' INFO: ' + newArg + '<br>\n');
}

extensions = {
	".html" : "text/html",
	".css" : "text/css",
	".js" : "application/javascript",
	".png" : "image/png",
	".gif" : "image/gif",
	".jpg" : "image/jpeg",
	".cgi" : "application/x-httpd-cgi",
};

server.on('error', function (err) {
  console.error('Error: %s occurred. Address: %s port: %s system call: %s.', err.code, err.address, err.port, err.syscall);
});

server.listen(port, function (err) {
  //console.error(Object.keys(server.address()));
	var	info = server.address();
  console.log('Command server started at address %s port %s family %s',info.address, info.port, info.family);
});

logger.on('error', function (err) {
  console.error('Error: %s occurred. Address: %s port: %s system call: %s.', err.code, err.address, err.port, err.syscall);
});

logger.listen(logPort, function (err) {
	var	info = logger.address();
  console.log('Log server started at address %s port %s family %s',info.address, info.port, info.family);
});

function textToHTML(text)
{
	return ((text || "") + "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\t/g, "    ")
		.replace(/ /g, "&#8203;&nbsp;&#8203;")
		.replace(/\r\n|\r|\n/g, "<br />");
}

function doCGI(contents, res) {
	var
	cgiCommand = JSON.parse(contents),
	command = cgiCommand.command,
  options = cgiCommand.options;

  if (Array.isArray(options)) {
    options = options;
  } else {
    options = [];
  }

	const { spawn } = require('child_process');
	const child = spawn(command, options);
	var response = "";

	child.stdout.on('data', function (data) {
		response += data.toString ();
	});

	child.stderr.on('data', function (data) {
		response += data.toString ();
	});

	child.on('error', function (err) {
		console.error('child stderr: %s.',data);
		response += data.toString ();
	});

	child.on('close', (code, signal) => {
  	console.log('child process %s terminated with code %s and/or signal %s', command, code, signal);
		response += data.toString ();
	});

	child.on('exit', function (code, signal) {
		console.log('child process %s exited with code %s and/or signal %s', command, code, signal);
		if (code == 0) {
			//console.log(response);
			response = textToHTML(response);
			var html = htmlbase();
			html += '		<body>';
			html += '		<div id="inlineImage"></div>';
			html += '		<h1>' + cgiCommand.description + '</h1>';
			html += '		<pre>';
			html += '		' + response;
			html += '		</pre>';
			html += '		</body>';
			html += '</html>';
			res.writeHead(200, {
				"Content-type" : "text/html",
				"Content-Length" : html.length
			});
			res.end(html);
		}
	});
};

function getFile(req, res) {
	var	newPath = path.join(rootFolder, req.url);
	newPath = (rootFolder === newPath) ? path.join(rootFolder, 'index.html')  : newPath;

	var
	filePath = path.dirname(newPath),
	fileName = path.basename(newPath),
	ext = path.extname(newPath),
	fileShort = path.basename(newPath, ext),
  mimeType = extensions[ext];

	console.log('newPath:' + newPath);
	console.log('filePath:' + filePath); 
	console.log('fileName:' + fileName);
	console.log('ext:' + ext);
	console.log('file:' + fileShort);
	console.log('mimeType:' + mimeType);

	fs.readFile(newPath, function(error, contents) {
		if(!error) {
			if(mimeType === "application/x-httpd-cgi") {
				console.log('CGI page %s requested.', fileName );
				doCGI(contents, res);
			} else if(!ext || !mimeType) {
				console.log('Unsupported media page requested');
			  res.writeHead(415, {'Content-Type': 'text/html'});
			  var html = htmlbase();
			  html += '<body>';
			  html += '<h1>Unsupported Media Type</h1>';
			  html += '<p>Sorry, but The filetype of the request is unsupported.</p>';
			  html += '</body>';
			  html += '</html>';
			  res.end(html);
			} else {
				console.log('Page %s requested.', fileName );
				res.writeHead(200, {
					"Content-type" : mimeType,
					"Content-Length" : contents.length
				});
			res.end(contents);
			};
		} else {
			if (fileName == 'index.html') {
				console.log('Index page requested');
				res.writeHead(200, {'Content-Type': 'text/html'});
				var html = htmlbase();
				html += '<body>';
				html += '<h1>Index</h1>';
				html += '<p>Nothing to see here :).</p>';
				html += '</body>';
				html += '</html>';
				res.end(html);
			} else {
				console.log('Non-existent page requested');
				res.writeHead(404, {'Content-Type': 'text/html'});
				var html = htmlbase();
				html += '<body>';
				html += '<h1>Page Not Found</h1>';
				html += '<p>Sorry, but the page you were trying to view does not exist.</p>';
				html += '</body>';
				html += '</html>';
				res.end(html);
				console.error('%s occurred. Code: %s system call: %s path %s.', error.errno, error.code, error.syscall, error.path);
				console.error(error.message);
			};
		};
	});
};

function requestHandler(req, res) {
	getFile(req, res);
};

function logHandler(req, res) {
	fs.readFile(logFolder + 'debug.log',function(err, contents) {
	  var html = htmlbase();
	  html += '		<body>';
	  html += '		<div id="inlineImage"></div>';
	  html += '		<h1> Log </h1>';
	  html += '		<pre>' + contents + '</pre>';
	  html += '		</body>';
  	html += '</html>';
	  res.writeHead(200, {
		  "Content-type" : "text/html",
		  "Content-Length" : html.length
	  });
	  res.end(html);
	});
};

function htmlbase () {
var html = "";
html += '<!doctype html>\n';
html += '<html lang="en">\n';
html += '<head>\n';
html += '    <meta charset="utf-8">\n';
html += '    <title>Server</title>\n';
html += '    <link id="dynamic-favicon" rel="icon" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==">\n';
html += '    <style>\n';
html += '        * {';
//html += '            line-height: 1.2;\n';
html += '            margin: 0;\n';
html += '        }\n';
html += '        html {\n';
html += '            color: #888;\n';
//html += '            display: table;\n';
html += '            font-family: sans-serif;\n';
html += '            height: 100%;\n';
html += '            text-align: center;\n';
html += '            width: 100%;\n';
html += '        }\n';
html += '        body {\n';
//html += '            display: table-cell;\n';
html += '            vertical-align: middle;\n';
html += '            margin: 2em auto;\n';
html += '        }\n';
html += '        h1 {\n';
html += '            color: #555;\n';
html += '            font-size: 2em;\n';
html += '            font-weight: 400;\n';
html += '        }\n';
html += '        p {\n';
html += '            margin: 0 auto;\n';
html += '            width: 280px;\n';
html += '        }\n';
html += '        pre {\n';
html += '            color: #007;\n';
html += '            text-align: left;\n';
html += '            margin: 100px 200px;\n';
html += '            width: 100%;\n';
html += '        }\n';
html += '    </style>\n';
html += '    <script>\n';
html += '  var str = "data:image/x-icon;base64,';
html +=   'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAKQWlDQ1BJQ0MgUHJvZmlsZQAASA2d';
html +=   'lndUU9kWh8+9N73QEiIgJfQaegkg0jtIFQRRiUmAUAKGhCZ2RAVGFBEpVmRUwAFHhyJjRRQLg4Ji';
html +=   '1wnyEFDGwVFEReXdjGsJ7601896a/cdZ39nnt9fZZ+9917oAUPyCBMJ0WAGANKFYFO7rwVwSE8vE';
html +=   '9wIYEAEOWAHA4WZmBEf4RALU/L09mZmoSMaz9u4ugGS72yy/UCZz1v9/kSI3QyQGAApF1TY8fiYX';
html +=   '5QKUU7PFGTL/BMr0lSkyhjEyFqEJoqwi48SvbPan5iu7yZiXJuShGlnOGbw0noy7UN6aJeGjjASh';
html +=   'XJgl4GejfAdlvVRJmgDl9yjT0/icTAAwFJlfzOcmoWyJMkUUGe6J8gIACJTEObxyDov5OWieAHim';
html +=   'Z+SKBIlJYqYR15hp5ejIZvrxs1P5YjErlMNN4Yh4TM/0tAyOMBeAr2+WRQElWW2ZaJHtrRzt7VnW';
html +=   '5mj5v9nfHn5T/T3IevtV8Sbsz55BjJ5Z32zsrC+9FgD2JFqbHbO+lVUAtG0GQOXhrE/vIADyBQC0';
html +=   '3pzzHoZsXpLE4gwnC4vs7GxzAZ9rLivoN/ufgm/Kv4Y595nL7vtWO6YXP4EjSRUzZUXlpqemS0TM';
html +=   'zAwOl89k/fcQ/+PAOWnNycMsnJ/AF/GF6FVR6JQJhIlou4U8gViQLmQKhH/V4X8YNicHGX6daxRo';
html +=   'dV8AfYU5ULhJB8hvPQBDIwMkbj96An3rWxAxCsi+vGitka9zjzJ6/uf6Hwtcim7hTEEiU+b2DI9k';
html +=   'ciWiLBmj34RswQISkAd0oAo0gS4wAixgDRyAM3AD3iAAhIBIEAOWAy5IAmlABLJBPtgACkEx2AF2';
html +=   'g2pwANSBetAEToI2cAZcBFfADXALDIBHQAqGwUswAd6BaQiC8BAVokGqkBakD5lC1hAbWgh5Q0FQ';
html +=   'OBQDxUOJkBCSQPnQJqgYKoOqoUNQPfQjdBq6CF2D+qAH0CA0Bv0BfYQRmALTYQ3YALaA2bA7HAhH';
html +=   'wsvgRHgVnAcXwNvhSrgWPg63whfhG/AALIVfwpMIQMgIA9FGWAgb8URCkFgkAREha5EipAKpRZqQ';
html +=   'DqQbuY1IkXHkAwaHoWGYGBbGGeOHWYzhYlZh1mJKMNWYY5hWTBfmNmYQM4H5gqVi1bGmWCesP3YJ';
html +=   'NhGbjS3EVmCPYFuwl7ED2GHsOxwOx8AZ4hxwfrgYXDJuNa4Etw/XjLuA68MN4SbxeLwq3hTvgg/B';
html +=   'c/BifCG+Cn8cfx7fjx/GvyeQCVoEa4IPIZYgJGwkVBAaCOcI/YQRwjRRgahPdCKGEHnEXGIpsY7Y';
html +=   'QbxJHCZOkxRJhiQXUiQpmbSBVElqIl0mPSa9IZPJOmRHchhZQF5PriSfIF8lD5I/UJQoJhRPShxF';
html +=   'QtlOOUq5QHlAeUOlUg2obtRYqpi6nVpPvUR9Sn0vR5Mzl/OX48mtk6uRa5Xrl3slT5TXl3eXXy6f';
html +=   'J18hf0r+pvy4AlHBQMFTgaOwVqFG4bTCPYVJRZqilWKIYppiiWKD4jXFUSW8koGStxJPqUDpsNIl';
html +=   'pSEaQtOledK4tE20Otpl2jAdRzek+9OT6cX0H+i99AllJWVb5SjlHOUa5bPKUgbCMGD4M1IZpYyT';
html +=   'jLuMj/M05rnP48/bNq9pXv+8KZX5Km4qfJUilWaVAZWPqkxVb9UU1Z2qbapP1DBqJmphatlq+9Uu';
html +=   'q43Pp893ns+dXzT/5PyH6rC6iXq4+mr1w+o96pMamhq+GhkaVRqXNMY1GZpumsma5ZrnNMe0aFoL';
html +=   'tQRa5VrntV4wlZnuzFRmJbOLOaGtru2nLdE+pN2rPa1jqLNYZ6NOs84TXZIuWzdBt1y3U3dCT0sv';
html +=   'WC9fr1HvoT5Rn62fpL9Hv1t/ysDQINpgi0GbwaihiqG/YZ5ho+FjI6qRq9Eqo1qjO8Y4Y7ZxivE+';
html +=   '41smsImdSZJJjclNU9jU3lRgus+0zwxr5mgmNKs1u8eisNxZWaxG1qA5wzzIfKN5m/krCz2LWIud';
html +=   'Ft0WXyztLFMt6ywfWSlZBVhttOqw+sPaxJprXWN9x4Zq42Ozzqbd5rWtqS3fdr/tfTuaXbDdFrtO';
html +=   'u8/2DvYi+yb7MQc9h3iHvQ732HR2KLuEfdUR6+jhuM7xjOMHJ3snsdNJp9+dWc4pzg3OowsMF/AX';
html +=   '1C0YctFx4bgccpEuZC6MX3hwodRV25XjWuv6zE3Xjed2xG3E3dg92f24+ysPSw+RR4vHlKeT5xrP';
html +=   'C16Il69XkVevt5L3Yu9q76c+Oj6JPo0+E752vqt9L/hh/QL9dvrd89fw5/rX+08EOASsCegKpARG';
html +=   'BFYHPgsyCRIFdQTDwQHBu4IfL9JfJFzUFgJC/EN2hTwJNQxdFfpzGC4sNKwm7Hm4VXh+eHcELWJF';
html +=   'REPEu0iPyNLIR4uNFksWd0bJR8VF1UdNRXtFl0VLl1gsWbPkRoxajCCmPRYfGxV7JHZyqffS3UuH';
html +=   '4+ziCuPuLjNclrPs2nK15anLz66QX8FZcSoeGx8d3xD/iRPCqeVMrvRfuXflBNeTu4f7kufGK+eN';
html +=   '8V34ZfyRBJeEsoTRRJfEXYljSa5JFUnjAk9BteB1sl/ygeSplJCUoykzqdGpzWmEtPi000IlYYqw';
html +=   'K10zPSe9L8M0ozBDuspp1e5VE6JA0ZFMKHNZZruYjv5M9UiMJJslg1kLs2qy3mdHZZ/KUcwR5vTk';
html +=   'muRuyx3J88n7fjVmNXd1Z752/ob8wTXuaw6thdauXNu5Tnddwbrh9b7rj20gbUjZ8MtGy41lG99u';
html +=   'it7UUaBRsL5gaLPv5sZCuUJR4b0tzlsObMVsFWzt3WazrWrblyJe0fViy+KK4k8l3JLr31l9V/nd';
html +=   'zPaE7b2l9qX7d+B2CHfc3em681iZYlle2dCu4F2t5czyovK3u1fsvlZhW3FgD2mPZI+0MqiyvUqv';
html +=   'akfVp+qk6oEaj5rmvep7t+2d2sfb17/fbX/TAY0DxQc+HhQcvH/I91BrrUFtxWHc4azDz+ui6rq/';
html +=   'Z39ff0TtSPGRz0eFR6XHwo911TvU1zeoN5Q2wo2SxrHjccdv/eD1Q3sTq+lQM6O5+AQ4ITnx4sf4';
html +=   'H++eDDzZeYp9qukn/Z/2ttBailqh1tzWibakNml7THvf6YDTnR3OHS0/m/989Iz2mZqzymdLz5HO';
html +=   'FZybOZ93fvJCxoXxi4kXhzpXdD66tOTSna6wrt7LgZevXvG5cqnbvfv8VZerZ645XTt9nX297Yb9';
html +=   'jdYeu56WX+x+aem172296XCz/ZbjrY6+BX3n+l37L972un3ljv+dGwOLBvruLr57/17cPel93v3R';
html +=   'B6kPXj/Mejj9aP1j7OOiJwpPKp6qP6391fjXZqm99Oyg12DPs4hnj4a4Qy//lfmvT8MFz6nPK0a0';
html +=   'RupHrUfPjPmM3Xqx9MXwy4yX0+OFvyn+tveV0auffnf7vWdiycTwa9HrmT9K3qi+OfrW9m3nZOjk';
html +=   '03dp76anit6rvj/2gf2h+2P0x5Hp7E/4T5WfjT93fAn88ngmbWbm3/eE8/syOll+AAAACXBIWXMA';
html +=   'AAsTAAALEwEAmpwYAAACOGlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPHg6eG1wbWV0YSB4bWxu';
html +=   'czp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNS40LjAiPgogICA8cmRmOlJE';
html +=   'RiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMi';
html +=   'PgogICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczp4';
html +=   'bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iCiAgICAgICAgICAgIHhtbG5zOnRpZmY9';
html +=   'Imh0dHA6Ly9ucy5hZG9iZS5jb20vdGlmZi8xLjAvIj4KICAgICAgICAgPHhtcDpDcmVhdG9yVG9v';
html +=   'bD5BZG9iZSBQaG90b3Nob3AgQ1M1IFdpbmRvd3M8L3htcDpDcmVhdG9yVG9vbD4KICAgICAgICAg';
html +=   'PHRpZmY6WVJlc29sdXRpb24+NzI8L3RpZmY6WVJlc29sdXRpb24+CiAgICAgICAgIDx0aWZmOk9y';
html +=   'aWVudGF0aW9uPjE8L3RpZmY6T3JpZW50YXRpb24+CiAgICAgICAgIDx0aWZmOlhSZXNvbHV0aW9u';
html +=   'PjcyPC90aWZmOlhSZXNvbHV0aW9uPgogICAgICA8L3JkZjpEZXNjcmlwdGlvbj4KICAgPC9yZGY6';
html +=   'UkRGPgo8L3g6eG1wbWV0YT4KUZ7Q/gAADPxJREFUeAHtWgtsHMUZnpndvTvbOA9CCI+0omkIvrvU';
html +=   'duyopEhQ8xCFQkURcgRVeQgKUUVBVajjxE7jc/EjcUtdQYoUqvJQS4VsARLQQlWiGEFLW+HYjnN2';
html +=   'EruEkIhAHEjw2Wff3u5Mv3/v9nzBTvDj7FTqTXKe2d3Zmf//5n/NP8tYtmQRyCKQRSCLQBaBLAJZ';
html +=   'BLII/H8iwM8W2y2qXOtpG3DmD5QtVmt5q322aJnTeYlxpdg44EOKifIWps0pMZhMn6sJiUHWViaw';
html +=   '0hbNWd8ZWCsE+55SylaStVbz3j/T/ZAq02tYm805U3Q922XcSmR8Qqz2A+2l+lOr2+M0dl2Xfw1X';
html +=   'vEn38iuFlpjejitmm+p1JtSG6qLevdTvgfdKDfcdup6tMqsAhHaV6aGr25wVb+7xXxg1eQNW9h6h';
html +=   'c4aaxWPSxDrrug+ygGLFpOKcbxdCq9lU2H2C7qWPQdeZLrMCgKvLrWuZTTrf39VTIZWs8vhEvoXV';
html +=   '1gBAPC7f1LlaD2nIsxRrNnxijWUCDQ+ejcgBJVhoc1Hvk8SwYzBZqwpxJv+nAQiFoOc1ZSLEE6te';
html +=   '1+2/lVtsq5ErVlgxMOflzIzKPsHVxqrifS+lM1PfEbyHcfWokcOXOn0BhDmiOjVNVWwq7H2T+pJa';
html +=   '7ChttzJpHzIlARzEpfR8695gkWXJJsMjrpd2YsXNURkRXDSYJxb/itSCjGK4lfHy8nJWzlolMfXL';
html +=   'rsI8U1rViqlHDK/w0LukKrbNXoTabNwUDPcTEGQoXZDpeiZlxgCk62hDb8EiFeO1sOoP6l5HrZmE';
html +=   'fOP6WV3Z1ZUl+z8iYtPfcYlPZ6oxHFwu42qrprPb4DIZGUuyF7Acj3mEXl9RtGeYXGkrKyevMqP4';
html +=   'YdoAJAhgIIA5BMCtPQSXVuPJEYscXTaIaPW24moDdPmfxKhj2SHCiAImdHE05ro0j9G4x38dVr8J';
html +=   'Y64asw/qCBdyc1XRvudoTAfMsjb7dGNSnzOVaQFAhLp6WN8Z/A6WuMnIEYUOkdDzeFQdAkGbq4t7';
html +=   '/kiTE5GsrE1O1oiRegRYOXdXt6HL/2MpWS2AWJwCYlT+gyu5oWrV/r87DIKm6YAwZQBc5nfAIH1q';
html +=   'RJ/TPeIOG2JOri0+KmMApiknGmlcf8WRETKKgZoxRs60EhM9S1eV5oPFC4Y/N2uZVA9BvTikzVkF';
html +=   '25RPVq/qfXC6IEwZAHJJtDL1nf7t5yzSHxw8ZjmuS9qsBf57E/z3+0RMuk4TrXTPlRpqpwqetbQy';
html +=   '0bO47BRaaH/gGsf0oKi+y7+SSd6kefiNAJzNO19nQ8etzQChPh2w1PgZbSQZebxvube+I3AI1l7V';
html +=   '7Q58WL83eLU7DxHrMuzem7DGWI5qTPhw7KbDFCSJxiRQ3SeNnf5b63b7j2/rAQ0dgU73/lTrU1D/';
html +=   'speTUqe2vrdsvq359uYsEEtHB+0/VBX13hUKBz0sELZCXwhWKCgqLV12Do8bsrJg/xDmUKQa+DlB';
html +=   'zY6PSnMHjo2WaIItV0ougHWkaHAQAdIhZce6q0r6B4iuFoyzlgIr1CQt5ErrdhfszF2gXzM6KMNm';
html +=   '0fnFjmukRTqNkZ2Iv4SvmujJGe6NWiJhxRPUeqlrIBCw05l3V7doReB+K+L9OD4iPtjW5b+c+jrM';
html +=   'g9CGzuCWgU+iB0Dv25qHPePJ1Zq9udpvEA0+De+xU3LPfuwdnq3vXrnEZZ5qMqg0jlLccGo0A2xx';
html +=   'gqYpLek0d4PnYtZBLBRNzmGKqR5XyhJ3BFPn+eZpPkR3vniMzae7JBWrugKv5S4UN4xEKPwVtA9A';
html +=   '5AdbjwK/LxAaM8uUCz0+7e7RIXn91nBwzdpg+EPyEKyWeo3ZFBAyRbYT79PfaUnA2OtnaLUlnkmp';
html +=   'LIr/6eeWkoLgwznztRsiA3HbMtlJM6q2WJJfC8O2mn5K8mvio+oRGWdHop/bzJsnLgSAT7nvs5pU';
html +=   'a8aNlFGZ8UinGQCewXFXkBQsE2JbFGnLW2JRiJ9XaLat7kW88PIEr++q617ZyuJ252jEJqG7pqnH';
html +=   'f+kG3tuXUK+EGkzw3pRuzZ4ETEAGNrsJABRUARYVrpPpBj+Q3pVEnGKMbe9clr/5G3sPC8GfyTtX';
html +=   'JykwEARdRn0vzI9MW+TT56L2rEvAKRPyxL6fC3YEgVMx4nuYL/YCosknhM46DCN+cKj2wGfrQk7y';
html +=   'xEmg5OeZ1UND3pcFwJtvaHtovKOl7TOK/9NpmlsAkjNzJrZzwW+mvABEYqXhZTtgAJkd147rt/g/';
html +=   'qfs+PwzR7IfSdA9F2DtVJeFEuOtSnjSC7uVM6rlVAUlCz1h1cfivpqnugM0/RgkQKkiWMMT653lz';
html +=   'RRC/G5AX+IkOYCSTYQQ87fVdgWupn5tsoXYmypwC4BJM4XT1yvALXqEvs2P2bQhpm82YegMJkC54';
html +=   'hA9jw/YwJUVIYSApDC6xRDP4m43dK8soy/TRzaUZyx6fFRU4cfR9LyJHURHcQ5EhZYZS2SFKioyy';
html +=   '2PlSacvMUXWlkmodgFkCI8iRVPk5+rZdFMl3jKkL6EzqOQOAVlLTWOQXXYHLj38SfdXgXEMOoQIu';
html +=   '8OlfH/5WzuDSd2MUSVKyAwwdTP52YvPzCmK/f8MDIDxiX6V9yMOXtsVmwnT6u3MGAE1KblBwKbz5';
html +=   '2mKyfrFh+QPcfnr9V94doRjf8e9lcHPtEX408qkWuvqDUWawo9g1WGBeQ8xpfXZkKexIPxmOjEjB';
html +=   'nAHg7N8Zz0Pef1d9h/9ThAGLIBXX1nUGaq350ca1XwOzrA18pUo81FG8gMXMx8G8VzcEMy27kzZB';
html +=   'FCesS54zpHpPszFnANB6wQc4GyfFRShvoXhi+ITFYNy2sJM590Ed9mIXeAx8mADLi0BpiVKxEq7z';
html +=   'RZQTjEVtKTziUeLz6Nm2AZ+BCAM5bCIGe6LJexIunUOSzcXh7XWdQRLiJkSCOXB/F4PJi1NCnYzz';
html +=   'KKFKmWHECB/AHdxZFQz3kAdBosQO0dQUXVPt/KfW1MvkiU8b26fLBIlI8SDGh+gy9nF/hx7CPj+t';
html +=   'm9PEaibZGXtCIkwgGEwuN0fYesT6Lw2ftDuiJ+3/oD6Euh/S8d5oRP4Jlv/u/Lx4Afq/QzFAT22r';
html +=   'egqJUxoN05tOjWYPS5w0p0Acm+6MrSmpgMuJxzTNaK5P4ZADaW92Ffb5ax6+dCzzS4cXtW2JeZHd';
html +=   'GGesFpYuk6Fd+XplSRulyZuTPxY6eIkvb3CeNjxv0A45NiExBv11DSSSHjYLtUsER1fhdhC7RkiC';
html +=   'Qi4icRgDmRg339go41tTAoAGT+YER6Czf/Pli3sjA/ISW/B36zr9v/eeY1RVLG8/RvvWx/uOULBi';
html +=   'QYY9nOskroxpIpU7cA5HSGK+XSbc7wO+yDTNRd8Q0OZn3eo2Z2+wra9waXw43iA4v5MOVUEDG4rL';
html +=   'V4k1AonGpfZki7uok+3v6B0lNylgiTOrBenw71JykkJaBCwnhVC1xhLjdxUX7Bmu61xxMVd6G6zE';
html +=   'cuQFsPMTxRtXhrtCCPLI54+bNKnTzv0k2D3JM0FKuXnicgNc6UaPj+dRJhq5A5rzeauo5y5nPHp/';
html +=   'ihIwZQCIONJ1/BwGIAlr4Z8bPHn86zjidtLjCGMP414fbFMRui8iQmHQDiB3WJDMDNO8pxVVGp8k';
html +=   'w11NBEO3IxNcb+TyZRQiJw9Q9wghKjcVhd8gmsggJsemy0mXaQFAo9OEtTA+hDwZteNadAM4qkRO';
html +=   'Lx+rgLQWjr+hn1RT0sy25E1Vhb1/ocxuSl+/SCbGPOVbgs7gN+E8t+GcsIw8AlwmeYTj8Ai1ZETp';
html +=   'dTKMLeWAZ4or7049bQDcAdL1btvuyy6SmnY/pP0msH0eXCScmDogNL2pqrD7rYnemeheUzh4QdyS';
html +=   'j+L9HxHTYI4OXRSSI7/1GbxmfTBMnnhaOu/O59YzBsAZCCsXYmVa+so68f0grHkw7Lgq6ocU12ok';
html +=   'PfYjPR5x0tvlTNEJMT1zvyXo69r7M0gXfUswzzlxQhAEsX9d02TlxsJ93dQ3eVBCxu60akT9JlMy';
html +=   'A0ByppTuph1WksEzuoO3Ix34Q7B6I3SnXxNi/caisGO5XSIb8S0BXOpWGNUVqTPGYbWPa7yyqij8';
html +=   'CvUj9WG1OGNM2h/33ZnUGQUgnRDHRtRCMkBsY5e/QjJOp7wkyokvREz5mtK0nwpp58BGNEPPr3O+';
html +=   'JXD0XJ2E2NfFi3qayca4SRCSkvQ5MtGeNQBSxEE98E81/KtgEfPxbbCb95FhxMoSGEMQYg2rTiDQ';
html +=   'OQCZ8h0erm/Btpj2BRnR8xQtEzRmHwBiIs3yJ74SY48hy3MF5QiokIWH2O/E9oK+EttN977sWwLq';
html +=   'k4kyJwAQoSn7kIzUGroK7lZK3AY7ZuHTmefhz190+iGaY29lVs8zAVTGxqDwFoONA54AIs+QsYkm';
html +=   'OdA4Qib53oy7UfxAewB3IPdrEPc6W2cRyCKQRSCLQBaBLAJZBLIIzDIC/wV2zjDOsBjEKwAAAABJ';
html +=   'RU5ErkJggg=="\n';
html +=   'var image = new Image();\n';
html +=   'image.src = str;\n';
html +=   'image.onload = function() {\n';
html +=   '  document.getElementById("inlineImage").appendChild(image);\n';
html +=   '  document.head || (document.head = document.getElementsByTagName("head")[0]);\n';
html +=   '  var link = document.createElement("link"), oldLink = document.getElementById("dynamic-favicon");\n';
html +=   '  link.id = "favicon";\n';
html +=   '  link.align = "top";\n';
html +=   '  link.rel = "shortcut icon";\n';
html +=   '  link.type = "image/x-icon";\n';
html +=   '  link.href = str;\n';
html +=   '  if (oldLink) {\n';
html +=   '    document.head.removeChild(oldLink);\n';
html +=   '  }\n';
html +=   '  document.head.appendChild(link);\n';
html +=   '}\n';
html +=   '</script>\n';
html += '</head>\n';
return html;
};

const colors = {
 Reset: "\x1b[0m",
 Bright: "\x1b[1m",
 Dim: "\x1b[2m",
 Underscore: "\x1b[4m",
 Blink: "\x1b[5m",
 Reverse: "\x1b[7m",
 Hidden: "\x1b[8m",
 fg: {
  Black: "\x1b[30m",
  Red: "\x1b[31m",
  Green: "\x1b[32m",
  Yellow: "\x1b[33m",
  Blue: "\x1b[34m",
  Magenta: "\x1b[35m",
  Cyan: "\x1b[36m",
  White: "\x1b[37m",
  Crimson: "\x1b[38m"
},
 bg: {
  Black: "\x1b[40m",
  Red: "\x1b[41m",
  Green: "\x1b[42m",
  Yellow: "\x1b[43m",
  Blue: "\x1b[44m",
  Magenta: "\x1b[45m",
  Cyan: "\x1b[46m",
  White: "\x1b[47m",
  Crimson: "\x1b[48m"
 }
};

/*

	fs.readdir(filePath,function(error, directory) {
		if(!error) {
		
			directory.forEach(function(file) {

				if (file.indexOf(fileShort) >= 0) {
			  	console.log('File found: ', path.join(filePath, file));
			  	if(!ext || !mimeType) {
						console.log('Unsupported media page requested');
			  		res.writeHead(415, {'Content-Type': 'text/html'});
			  		var html = htmlbase();
			  		html += '<body>';
			  		html += '<h1>Unsupported Media Type</h1>';
			  		html += '<p>Sorry, but The filetype of the request is unsupported.</p>';
			  		html += '</body>';
			  		html += '</html>';
			  		res.end(html);
					} else if (fileName == 'index.html') {
						console.log('Index page requested');
						res.writeHead(200, {'Content-Type': 'text/html'});
						var html = htmlbase();
						html += '<body>';
						html += '<h1>Index</h1>';
						html += '<p>Nothing to see here :).</p>';
						html += '</body>';
						html += '</html>';
						res.end(html);
					} else {
						console.log('Page %s requested.', fileName );
						res.writeHead(200, {
							"Content-type" : mimeType,
							"Content-Length" : contents.length
						});
						res.end(contents);
					};

				} else {
					console.log('Non-existent page requested');
					res.writeHead(404, {'Content-Type': 'text/html'});
					var html = htmlbase();
					html += '<body>';
					html += '<h1>Page Not Found</h1>';
					html += '<p>Sorry, but the page you were trying to view does not exist.</p>';
					html += '</body>';
					html += '</html>';
					res.end(html);
				};
			});
		} else {
  				console.error('%s occurred. Code: %s system call: %s path %s.', error.errno, error.code, error.syscall, error.path);
  				console.error(err.message);
			};
	});
--------------------------------------------
fs.readFile(filePath,function(err, contents) {
		if(!err) {
			if(mimeType === "application/x-httpd-cgi") {
				console.log('CGI page %s requested.', fileName );
				doCGI(contents, res);
			} else {
				console.log('Page %s requested.', fileName );
				res.writeHead(200, {
					"Content-type" : mimeType,
					"Content-Length" : contents.length
				});
			res.end(contents);
			};
		} else {
			if (fileName == "index.html") {
				console.log('Index page requested');
				res.writeHead(200, {'Content-Type': 'text/html'});
				var html = htmlbase();
				html += '<body>';
				html += '<h1>Index</h1>';
				html += '<p>Nothing to see here :).</p>';
				html += '</body>';
				html += '</html>';
				res.end(html);
  			console.error('%s occurred. Code: %s system call: %s path %s.', err.errno, err.code, err.syscall, err.path);
  			console.error(err.message);

			} else {
				fs.readdir(filePath,function(err, files) {
					if(!err) {
						files.forEach(function(file){
   			     //if (file.indexOf(filter)>=0) {
    		 	     console.log('File found: ',filePath + file);
				console.log('Unsupported media page requested');
				res.writeHead(415, {'Content-Type': 'text/html'});
				var html = htmlbase();
				html += '<body>';
				html += '<h1>Unsupported Media Type</h1>';
				html += '<p>Sorry, but The filetype of the request is unsupported.</p>';
				html += '</body>';
				html += '</html>';
				res.end(html);
  			console.error('%s occurred. Code: %s system call: %s path %s.', err.errno, err.code, err.syscall, err.path);
  			console.error(err.message);

						});
					} else {
				console.log('Non-existent page requested');
				res.writeHead(404, {'Content-Type': 'text/html'});
				var html = htmlbase();
				html += '<body>';
				html += '<h1>Page Not Found</h1>';
				html += '<p>Sorry, but the page you were trying to view does not exist.</p>';
				html += '</body>';
				html += '</html>';
				res.end(html);
  			console.error('%s occurred. Code: %s system call: %s path %s.', err.errno, err.code, err.syscall, err.path);
  			console.error(err.message);
					}
				});


			};
		};
	});







*/

