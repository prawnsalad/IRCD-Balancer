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