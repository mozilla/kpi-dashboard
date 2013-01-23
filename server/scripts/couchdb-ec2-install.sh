#!/bin/bash

#
# This script installs and configures couchdb on a fresh Amazon Linux AMI instance.
#
# Must be run with root privileges
# Tested with Amazon Linux AMI release 2011.02.1.1 (ami-8c1fece5)
#

export BUILD_DIR="$PWD"

# install gem dependencies
sudo yum install -y gcc gcc-c++ libtool curl-devel ruby-rdoc zlib-devel openssl-devel make automake rubygems perl git-core
sudo gem install rake --no-ri --no-rdoc

if [ ! -e "/usr/local/bin/couchdb" ]
then

  if [ ! -d "$BUILD_DIR/build-couchdb" ]
  then
    # get build-couch code
    git clone git://github.com/iriscouch/build-couchdb
    cd $BUILD_DIR/build-couchdb/
    git submodule init
    git submodule update
  fi

  # run build-couch
  cd $BUILD_DIR/build-couchdb/
  sudo rake --quiet git="git://git.apache.org/couchdb.git tags/1.2.0" install=/usr/local > /dev/null 2> couch_err.log
fi

# install our .ini
cat << 'EOF' > /usr/local/etc/couchdb/local.ini
[couchdb]
delayed_commits = false

[httpd]
bind_address = 0.0.0.0

[couch_httpd_auth]
require_valid_user = false

[log]
level = debug

[admins]
EOF

# allow beam to bind to port 80 (not necessary if you make httpd.port >=1024)
sudo setcap 'cap_net_bind_service=+ep' /usr/local/lib/erlang/erts-5.9.2/bin/beam

if [ ! -e "/etc/logrotate.d/couchdb" ]
then
  # add couch.log to logrotate
  sudo ln -s /usr/local/etc/logrotate.d/couchdb /etc/logrotate.d/
  # change to daily rotation
  sudo sed -e s/weekly/daily/g -i /usr/local/etc/logrotate.d/couchdb
  #logrotate -v -f /etc/logrotate.d/couchdb 
fi

# add couchdb user
sudo adduser --system --home /usr/local/var/lib/couchdb -M --shell /bin/bash --comment "CouchDB" couchdb

# change file ownership
sudo chown -R couchdb:couchdb /usr/local/etc/couchdb /usr/local/var/lib/couchdb /usr/local/var/log/couchdb /usr/local/var/run/couchdb

# run couchdb on startup
sudo ln -s /usr/local/etc/rc.d/couchdb /etc/init.d/couchdb
sudo chkconfig --add couchdb
sudo chkconfig --level 345 couchdb on

sudo service couchdb start

# done!
echo
echo
echo "Installation complete!"
echo
echo "Couchdb is ready to start. Run:"
echo "    sudo service couchdb start"
