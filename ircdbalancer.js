#!/usr/bin/env node

var net = require('net'),
    tls = require('tls'),
    fs = require('fs'),
    os = require('os'),
    util = require('util'),
    _ = require('./underscore-min.js');



/**
 *  Logging and control socket outputs
 *
 *  Levels:
 *   -1 - Fatal Error
 *    1 - Error
 *    2 - Notice
 *    3 - Info
 *    4 - Debug
 *
 *  logControl will be set to a function when ran as a deamon
*/
var logControl = false,
    logLevel = 3;
var log = function (what, level) {
    var ts = '';

    if (typeof what !== 'string' && typeof what !== 'number') {
        what = util.inspect(what, false, 3);
    }

    level = level || 4;
    if (level > logLevel) return;

    // If this is going to stdout (logfile), then add timestamp
    if (!logControl) ts = new Date().toString() + ' ';

    switch (level) {
        case -1:
          if (logControl) {
              logControl(what);
          } else {
              console.error(ts + what);
          }
          process.exit(-1);
          break;
        
        case 1:
            //util.debug(ts + what);
            console.error(ts + what);
            if (logControl) logControl(what);
            break;

        case 2:
            console.log(ts + what);
            if (logControl) logControl(what);
            break;

        case 3:
            if (logControl) {
                logControl(what);
            } else {
                console.log(ts + what);
            }
            break;

        case 4:
            if (logControl) {
                logControl(what);
            } else {
                console.log(ts + what);
            }
            break;
    }
};





/**
 *  Handles a socket and its data processing
 */
var SocketHandler = function (config) {
    var that = this;

    var allowed_into_buffer = [
        'USER', 'PASS', 'NICK', 'CAP'
    ];
    var required_in_buffer = [
        'USER', 'NICK'
    ];

    var applySocket = function (socket) {
        // Buffer incoming socket data
        socket.buffer_accepting = true;
        socket.buffer = '';
        socket.buffer_spli = [];

        socket.on('data', onData);
    };

    var onData = function (data) {
        if (!this.buffer_accepting) return;

        var that = this;

        this.buffer += data;
        var spli = this.buffer.toString().split('\n');
        if (spli.length <= 1) return;

        var command;
        _.each(spli, function (val, i) {
            // Leave the last one
            if (i === spli.length - 1) return;

            command = val.split(' ')[0];

            if (allowed_into_buffer.indexOf(command) !== -1) {
                //log('Command recieved: ' + command);
                that.buffer_spli.push(command);
            }

            // If we have everything or this is an unallowed command, process the socket buffer
            if (checkRequiredBuffers(that) || allowed_into_buffer.indexOf(command) === -1) {
                // Stop buffering incoming data
                that.buffer_accepting = false;
                processBuffer(that);
                return;
            }

        });
    };



    var checkRequiredBuffers = function (socket) {
        // Do we have all required commands?
        if (socket.buffer_spli.indexOf('USER') === -1 || socket.buffer_spli.indexOf('NICK') === -1) {
            return false;
        }

        return true;
    };

    var processBuffer = function (socket) {
        // If we don't have minimum requirements, leave now
        if (!checkRequiredBuffers(socket)) {
            log('Not enough data in buffer. Destroying socket.', 4);
            socket.destroy();
            return;
        }

        // All is good, start piping
        startPiping(socket);
    };



    var startPiping = function (socket) {
        var is_ssl = (typeof socket.encrypted === 'object'),
            ircd = selectIrcd(is_ssl),
            client_host = socket.remoteAddress,
            client_ip = socket.remoteAddress,
            server_connection = null;

        // If we couldn't find an IRCD, leave here
        if (!ircd) {
            log('Couldn\'t find a suitable IRCD', 2);
            socket.destroy();
            return;
        }
        
        log('Piping ' + client_ip + ' to ' + ircd.host + ':' + ircd.port, 4);
        var completePiping = function() {
            if (typeof ircd.webirc_pass === 'string') {
                server_connection.write('WEBIRC ' + ircd.webirc_pass + ' appliance ' + client_host + ' ' + client_ip + '\r\n');
            }

            server_connection.write(socket.buffer);

            // No need for event listeners anymore
            socket.removeAllListeners('data');
            socket.removeAllListeners('error');
            socket.removeAllListeners('timeout');

            // Clean the buffers up
            delete socket.buffer;
            delete socket.buffer_spli;

            // Start the piping
            socket.pipe(server_connection);
            server_connection.pipe(socket);
        };

        var serverConErrorHandler = function (err) {
            socket.destroy();
        };

        if (!is_ssl) {
            server_connection = net.connect(ircd.port, ircd.host, completePiping);
        } else {
            server_connection = tls.connect(ircd.port, ircd.host, completePiping);
        }

        server_connection.on('error', serverConErrorHandler);
        server_connection.on('timeout', serverConErrorHandler);

    };



    var selectIrcd = function (ssl) {
        // Set default options
        ssl = (typeof ssl === 'boolean') ? ssl : false;

        // Filter the ircd list to what we need
        //console.log('ssl', ssl);
        //console.log('ircd_pool', config.config.ircd_pool);
        var choices = [], ircd;
        _.each(config.config.ircd_pool, function (ircd) {
            var obj;
            if (ssl) {
                if (typeof ircd.ssl_port === 'number') {
                    // We're gonna modify this object so clone it
                    ircd = _.clone(ircd);

                    // We need to use the ssl_port
                    ircd.port = ircd.ssl_port;
                    delete ircd.ssl_port;
                    choices.push(ircd);
                }
            } else {
                if (typeof ircd.port === 'number') {
                    choices.push(ircd);
                } 
            }
        });
        
        ircd = choices[Math.floor(Math.random() * choices.length)];
        //console.log('selected ircd', ircd);
        return ircd;
    };


    return {
        applySocket: applySocket
    };
};





/**
 *  The server itself and limit management
 */
var ProxyServer = function (config_file) {
    var config = new Config(config_file),
        servers = [],
        socket_handler,
        limit_tmr,
        cons_per_sec = 0, print_stats = {print: false},
        state = 0,      // 0 = stopped, 1 = running
        accept_connections = true;

    var handleConnection = function (socket) {
        if (!accept_connections) return;

        log('Connection from ' + socket.remoteAddress, 4);
        cons_per_sec++;
        socket_handler.applySocket(socket);
    };

    var start = function () {
        if (state === 1) {
            log('Servers already running. Stop servers first to force a restart.', 2);
            return;
        }

        // Set the log level from the config
        logLevel = config.config.log_level;

        log('Starting ' + servers.length.toString() + ' server(s) with log level ' + logLevel, 2);
        _.each(servers, function (server) {
            try {
                server.server.listen(server.opts.port, server.opts.host);
                log('Server listening on ' + server.opts.host + ':' + server.opts.port.toString(), 2);

                state = 1;
            } catch (err) {
                log('Error starting server on ' + server.opts.host + ':' + server.opts.port.toString() + '. ' + err, 1);
            }
        });

        // If we haven't started already, periodically check the server limits
        if (!limit_tmr) {
            limit_tmr = setTimeout(checkLimits, 5000);
        }
    };

    var stop = function () {
        if (state === 0) {
            // Server have already been stopped
            return;
        }

        _.each(servers, function (server) {
            try {
                server.server.close();
            } catch (err) {
                // Server is already stopped
            }
        });

        log('Stopped server', 2);

        state = 0;
    };


    var setLimit = function (type, value) {
        config.config.limits[type] = value;
    };

    var checkLimits = function () {
        var stop_server = false, 
            trigger;

        if(typeof config.config.limits === undefined) {
          log('No limits defined');
          return false;
        }

        if (config.config.limits.load !== 0) {
            var load_avg = os.loadavg(),
                load_avg_0 = load_avg[0] * os.cpus().length,
                load_limit = config.config.limits.load * os.cpus().length;

            if (load_avg_0 > load_limit) {
                log('Limit: max load reached; ' + load_avg_0 + ' > ' + load_limit);
                stop_server = true;
            }
        }

        if (config.config.limits.connections !== 0) {
            var num_connections = 0;
            _.each(servers, function (server) {
                num_connections += server.server._connections;
            });

            if (num_connections >= config.config.limits.connections) {
                log('Limit: max connections reached; ' + num_connections + ' >= ' + config.config.limits.connections);
                stop_server = true;
            }
        }


        if (stop_server) {
            if (state === 1) {
                log('Not accepting new connections', 2);
                stop();
            }
        } else {
            if (state === 0) {
                log('Accepting connections', 2);
                start();
            }
        }
        limit_tmr = setTimeout(checkLimits, 5000);
    };

    var acceptConnections = function () {
        _.each(servers, function (server) {
            server.server.addListener('connection', handleConnection);
        });

        accept_connections = true;
    };


    var stopAcceptingConnections = function () {
        _.each(servers, function (server) {
            server.server.removeAllListeners('connection');
        });

        accept_connections = false;
    };


    var initServers = function () {
        var i, opts, server, server_conf;

        servers = [];

        _.each(config.config.servers, function (server_conf, i) {
            opts = {};
            server = {opts: server_conf, server: null};

            if (typeof server_conf.cert === 'string') {
                opts.cert = fs.readFileSync(server_conf.cert);
                opts.key = fs.readFileSync(server_conf.key);

                // This is necessary only if using the client certificate authentication.
                //opts.requestCert = true;

                if (typeof opts.ca === 'string') {
                    opts.ca = [fs.readFileSync(server_conf.ca)];
                }

                server.server = tls.createServer(opts);
                servers.push(server);
            } else {
                server.server = net.createServer();
                servers.push(server);
            }
        });

        acceptConnections();
    };


    var printStats = function () {
        var num_cons = 0,
            msg = '';
        //log('printStats');
        _.each(servers, function (server) {
            num_cons += server.server._connections;
        });
        msg = 'connections=' + num_cons.toString();

        msg += ', connections_per_sec=' + cons_per_sec.toString();

        if (print_stats.print) log(msg, 3);

        cons_per_sec = 0;
        _.delay(printStats, 1000);
    };


    var rehash = function () {
        config.reload();
        initServers();
    };

    rehash();

    socket_handler = new SocketHandler(config);

    printStats();

    return {
        rehash: rehash,
        start: start,
        stop: stop,
        setLimit: setLimit,
        config: config,
        print_stats: print_stats
    };
};





/**
 *  Config loader
 */
var Config = function (file_name) {
    var config = {};

    var reload = function () {
        var i, j,
            nconf = {},
            cconf = {},
            tmp_conf,
            that = this;
        

        try {
            delete require.cache[file_name];
            tmp_conf = require(file_name);
            nconf = tmp_conf.conf;

            _.each(nconf, function (val, j) {
                // If this has changed from the previous config, mark it as changed
                if (!_.isEqual(that.config[j], val)) {
                    cconf[j] = val;
                }

                that.config[j] = val;
            });

        } catch (e) {
            log('An error occured parsing the config file ' + file_name + ': ' + e.message, 1);
            return false;
        }

        return {new_config: nconf, changed_config: cconf};
    };

    
    return {
        config: config,
        reload: reload
    };
};









/**
 *  Server startup
 */

process.on( "SIGINT", function() {
  console.log("\nInterupted");
  process.exit(0);
});

/*
var nextTick = process.nextTick;

process.nextTick = function(callback) {
  if (callback === undefined) {
    return;
  }
  if (typeof callback !== 'function') {
    console.trace(typeof callback + ' is not a function');
    return;
  }
  if (nextTick !== undefined) {
    return nextTick(callback);
  }
};
*/

var config = process.env.IRC_CONFIG || __dirname + '/config.js';
if (!fs.existsSync(config)) { 
  log('Config not found: ' + config, -1);
} 

log('Using config ' + config, 2);
var proxy_server = new ProxyServer(config);
proxy_server.start();

// Make sure the balancer doesn't quit on an unhandled error
process.on('uncaughtException', function (e) {
    log('[Uncaught exception] ' + e, 1);
    //log('[Uncaught exception] ' + e.stack, 1);
});





/**
 *  Handle control messages while running
 */
var control = function (data, out) {
    var parts = data.toString().trim().split(' ');

    switch (parts[0]) {
        case 'loglevel':
            if (parts[1]) {
                logLevel = parts[1];
            }
            log('log_level = ' + logLevel.toString(), 3);
            break;

        case 'rehash':
            proxy_server.stop();
            proxy_server.rehash();
            proxy_server.start();
            break;

        case 'pool':
            log(proxy_server.config.config.ircd_pool, 3);
            break;

        case 'stats':
            proxy_server.print_stats.print = !proxy_server.print_stats.print;

            if (proxy_server.print_stats.print) {
                log('Printing stats', 3);
            } else {
                log('No longer printing stats', 3);
            }
            break;
    }
};


if (process.argv.indexOf('-d') === -1) {
    // Do not run as a deamon

    process.stdin.resume();
    process.stdin.on('data', control);

} else {
    // Run as a deamon, so start the control socket up

    (function () {
        var control_socket, client_socket;
        
        logControl = function (data) {
            if (client_socket) {
                if (typeof data === 'string' || typeof data === 'number') {
                    client_socket.write(data + '\n');
                } else {
                    client_socket.write(util.inspect(data) + '\n');
                }
            }
        };

        control_socket = net.createServer(function (socket) {
            client_socket = socket;
            socket.on('data', control);
        }).listen(__dirname + '/control.sock');
    })();
}
