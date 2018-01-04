try{
    var fs = require("fs");
    //load conf.json
    console.log("Loading config.json");
    var conf = JSON.parse(
        fs.readFileSync(process.argv[2],"utf8")
    );
    var syslog = require("modern-syslog");
    var syslog_options_keys = [
        "LOG_CONS",
        "LOG_PERROR",
        "LOG_PID",
        "LOG_NDELAY",
        "LOG_ODELAY",
        "LOG_NOWAIT"
    ];
    var syslog_options_values = [
        2, //LOG_CONS
        32,//LOG_PERROR
        1, //LOG_PID
        8, //LOG_NDELAY
        4, //LOG_ODELAY
        16 //LOG_NOWAIT
    ];
    //init syslog options
    var syslog_options = 0;
    for(var i=0; i < syslog_options_keys.length; i++) {
        if( conf.syslog_options.indexOf(syslog_options_keys[i]) !== -1 ) {
            syslog_options = syslog_options | syslog_options_values[i];
        }
    }
    var http = require("http");
    var server = http.createServer(function(req,res) {
        if( req.method === "POST" ) {
            var body = "";
            //retrieve post body
            req.on('readable', function(chunk) {
                var data = req.read(); 
                if( data ) {
                    body += data;
                }
            });
            req.on('end', function() {
                try{
                    var postJson = JSON.parse(body);
                    //create message splitting by alerts.
                    var messages = splitByAlerts(postJson);
                    if( req.url === "/syslog" ) {
                        syslog.open(conf.syslog_indent, syslog_options, conf.syslog_facility);
                        for(var i=0; i<messages.length; i++) {
                            var message = messages[i];
                            syslog.log(conf.syslog_priority, message);
                        }
                        syslog.close();
                        res.statusCode = 200;
                        res.end();
                    } else if( req.url === "/console" ) {
                        res.statusCode = 200;
                        console.log("----");
                        for(var i=0; i<messages.length; i++) {
                            var message = messages[i];
                            console.log(message);
                        }
                        console.log("----");
                        res.end(message);
                    } else {
                        res.statusCode = 404;
                        res.end("Not found.");
                    }
                } catch(err) {
                    res.statusCode = 500;
                    res.end("Internal server error. Details:" + err.message);
                }
            });
        } else if( req.method === "GET" ) {
            if( req.url === "/stop" ) {
                res.statusCode = 200;
                res.end("Server stoped.");
                console.log("Server stoped.");
                process.exit(); 
            } else {
                res.statusCode = 200;
                res.end();
            }
        } else {
            console.log(req.method);
            console.log(req.url);
            res.statusCode = 404;
            res.end("Not found.");
        }
    });
    console.log("Listening port:" + conf.http_port + " on host:" + conf.http_host);
    server.listen(conf.http_port, conf.http_host)
} catch(err) {
    console.log("An error occurred. Details:" + err.message);
}

function splitByAlerts(postJson) {
    var messages = [];
    var alerts = postJson.alerts;
    if(alerts && Array.isArray(alerts)) {
        if( alerts.length === 0 ) {
            messages.push(JSON.stringify(postJson));
        } else {
            for(var i=0; i<alerts.length; i++) {
                var copyJson = Object.assign(postJson);
                copyJson.alerts = [alerts[i]];
                messages.push(JSON.stringify(copyJson));
            }
        }
    } else {
        messages.push(JSON.stringify(postJson));
    }
    return messages;
}
