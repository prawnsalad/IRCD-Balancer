/**
 *  Example configuration
 *
 *  Servers - 
 *      Servers listen for client connections on specific ports.
 *      Multiple servers may be used (eg. for an extra SSL port).
 *
 *  IRCD Pool -
 *      Each IRCD you wish to balance the connections between must be set here.
 *      If the IRCD accepts SSL connections, specify the 'ssl_port' options also.
 */


var servers = [
    {host: '0.0.0.0', port: 6667},
    //{host: '0.0.0.0', port: 6697, cert:__dirname+'/server.cert.pem', key:__dirname+'/server.key.pem'}
];
var ircd_pool = [
    {host: 'irc1.network.com', port: 6667, webirc_pass: 'your_configured_webirc_password'},
    //{host: 'irc2.network.com', port: 6667, ssl_port: 6697, webirc_pass: 'your_configured_webirc_password'}
];



this.conf = {
	servers: servers,
	ircd_pool: ircd_pool
};