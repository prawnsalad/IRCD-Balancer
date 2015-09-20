IRCD-Balancer allows you to spread IRC clients between multiple IRC servers.
Why would you want to do this? Several methods of usage have come in use:
* Keeping the IRC leaves hidden from public view
* One entry point to the IRC network or network segment

Built in resource limits have been implimented to automatically shut-off the server should the balancer become overwhelmed with unwanted traffic, whilst allowing existing clients to continue talking safely.
This has become handy for networks that attract DDOS attacks.


## Prerequisites

IRCD-Balancer is built using Node.js, so you must have this installed first. http://nodejs.org/

## Install via git

* Clone the git repository:

    $ git clone git@github.com:prawnsalad/IRCD-Balancer.git

* Read and edit the configuration file:

    $ nano ircdbalancer_conf.js

## Install via download

* Download and unzip the source from:
  https://github.com/prawnsalad/IRCD-Balancer/zipball/master

* Read and edit the configuration file:

    $ nano ircdbalancer_conf.js


## Installing on system startup / Running as a deamon
There is an upstart script (ircdbalancer_upstart.conf) provided that may be used to install ircdbalancer as a deamon.

* Copy & rename contirb/upstart.conf to your upstart init folder

    $ sudo cp contrib/upstart.conf /etc/init/ircdbalancer.conf

* Copy all the ircdbalancer sources to its application folder

    $ mkdir /opt/ircdbalancer
    $ cp ./* /opt/ircdbalancer/

You can now use the following commands to control ircdbalancer:

    $ start ircdbalancer
    $ stop ircdbalancer
    $ restart ircdbalancer


## Running 
From the source folder:

    $ node ircdbalancer.js

As a deamon:

    $ start ircdbalancer


## Runtime commands
Once running, you can interact with ircdbalancer to update the config or look at simple statistics without turning the server off.

If running a deamon:

    $ nc -U /opt/ircdbalancer/control.sock

If running as normal, you can simply type into the console.

### Control commands

Enable / disable basic statistic reporting

    $ stats


View the current IRCD pool

    $ pool


Reload the configuration and rebind the server listeners

    $ rehash


## Bugs
Report bugs using the issue tracker on github: https://github.com/prawnsalad/IRCD-Balancer/issues
