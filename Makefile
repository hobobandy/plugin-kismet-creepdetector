# Our plugin directory name when we install
PLUGIN_NAME ?= creepdetector

# Look for the kismet source in /usr/src/kismet by default
KIS_SRC_DIR ?= /usr/src/kismet
KIS_INC_DIR ?= $(KIS_SRC_DIR)

BLDHOME	= .
top_builddir = $(BLDHOME)

# Try to include the base config
-include $(KIS_SRC_DIR)/Makefile.inc

# Set sane values if we don't have the base config
INSTALL ?= /usr/bin/install
plugindir ?= $(shell pkg-config --variable=plugindir kismet)
INSTUSR ?= root
INSTGRP ?= root

# As we have no live code, all we need is the manifest.conf to "compile"
all:	manifest.conf

# We have no requirements for install or userinstall, we just copy our data
install:
ifeq ("$(plugindir)", "")
	echo "No kismet install found in pkgconfig, assuming /usr/local"
	plugindir="/usr/local/lib/kismet/"
endif
	mkdir -p $(DESTDIR)/$(plugindir)/$(PLUGIN_NAME)
	$(INSTALL) -o $(INSTUSR) -g $(INSTGRP) -m 444 manifest.conf $(DESTDIR)/$(plugindir)/$(PLUGIN_NAME)/manifest.conf

	mkdir -p $(DESTDIR)/$(plugindir)/$(PLUGIN_NAME)/httpd
	cp -r httpd/* $(DESTDIR)/$(plugindir)/$(PLUGIN_NAME)/httpd

userinstall:
	mkdir -p ${HOME}/.kismet/plugins/$(PLUGIN_NAME)
	$(INSTALL) manifest.conf $(HOME)/.kismet/plugins/$(PLUGIN_NAME)/manifest.conf

	mkdir -p ${HOME}/.kismet/plugins/$(PLUGIN_NAME)/httpd
	cp -r httpd/* $(HOME)/.kismet/plugins/${PLUGIN_NAME}/httpd

clean:
	@echo "Nothing to clean"

