
[![DOI](https://zenodo.org/badge/273199904.svg)](https://zenodo.org/badge/latestdoi/273199904)

# Vent Display
A Ventilator Display that consumes PIRDS data and performs most clinical respiration calculations

This is an important part of the Public Invention's goal of creating an open source ventilator ecosystem.
This is a stand-alone .html file with about a thousand lines of JavaScript that implements a clinical display
that doctors want to see of an operating ventilator. It includes live data trace plots of pressure and flow, as
well as calculated values such as tidal volume.

![Screen Shot 2020-06-18 at 5 07 25 AM](https://user-images.githubusercontent.com/5296671/85007839-b52ec600-b121-11ea-92ae-3d29dba9fbb1.png)

You can see the vent-display from our [public data lake](http://ventmon.coslabs.com/), where you 
can find both live and [static](http://ventmon.coslabs.com/breath_plot?i=71.245.238.32.test_file_name.20200612135337) displays.

For a hands on demonstration of Vent Display and in-depth explanation of VentMon watch our screen cast (demonstration of Vent Display occurs at 10:56).    
[VentMon ScreenCast](https://youtu.be/OV9MrMjVOCI?t=638)

# The Control Interface

Public Invention, with help from the VentOS project from Helpful Engineering, is building Respireco, a complete, modular, composable respiration ecosystem.
In March 2021, we added a (collapsible) "control interface" to VentDisplay which controls the parameters of a mechanical ventilator. 
This outputs the resulting commands in the [Public Invention Respiration Control Standard (PIRCS)](https://github.com/PubInv/PIRCS-pubinv-respiration-control-standard) to a webserver via Ajax. The primary use case is for this information to be transmitted to a microcontroller running the [VentOS](https://gitlab.com/project-ventos/ventos) ventilation Open Source Operating System platform, a project of [Helpful Engineering](https://helpfulengineering.org/).

The program **serialserver.js** (see below) is such a webserver written in Express which make serial port transmissions of the PIRCS messages.

# Serialserver.js

Although it may be moved in the future, this repo is the current home of **serialserver.js**. This program combines two functions:
1. It accepts [PIRCS] commands via webrequest and sends them to a serial port, and 
2. It accepts [PIRDS] data via the serial port and tranmsits it via UDP requests to a UDP address and port combination.

It does both of these simultaneously while running.

A typical usage on a Mac looks like this:

>  node serialserver.js --uaddress=127.0.0.1 --sport=/dev/cu.usbserial-01D97104 --uport=6111

On a Windows machine, the serial port is likely named "COM4" or something similar. The parameters are:
1. sport is the name of the serial port
2. uport is the UDP port number (the PIRDS_logger users 6111 conventionally.)
3. uaddress is the ip address or url of the UDP port.

A typical use case for serialserver.js is to log the action of the [VentMon](https://github.com/PubInv/ventmon-ventilator-inline-test-monitor).
A second use is to log data (either real or mock data) produced by the [VentOS system](https://gitlab.com/project-ventos/ventos), independent of the VentMon. These two use cases are an 
example of composability of the PubInv Respireco system. 

# Volunteer Needed

This is a project with a rich set of features that need to be added involving respiration calculations. 
Additionally, there are GUI features such as the ability to scroll back in time that need to be added. Please contact <read.robert@gmail.com> if you would like to volunteer.
