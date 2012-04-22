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

* Copy ircdbalancer_upstart.conf to your upstart init folder

    $ sudo cp ircdbalancer_upstart.conf /etc/init/ircdbalancer.conf

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

    $ ns -U /opt/ircdbalancer/control.sock

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