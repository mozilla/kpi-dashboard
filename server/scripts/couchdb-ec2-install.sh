#!/bin/bash

#
# This script is derived from https://gist.github.com/kparlante/4270908
# It installs couchdb 1.2.0, which is unavailable via yum on ec2
# The script then launches couchdb and creates two users, admin/admin and dashboard/dashboard
# 
#

export BUILD_DIR="$PWD"

# install gem dependencies
sudo yum install -y gcc gcc-c++ libtool curl-devel ruby-rdoc zlib-devel \
                    openssl-devel make automake rubygems perl git-core \
                    help2man
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
cat << 'EOF' | sudo tee /usr/local/etc/couchdb/local.ini
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

# start up couch db to add users
sudo service couchdb start

# curl will fail without a delay
sleep 10

# create an admin user
HOST="http://localhost:5984"
curl -X PUT $HOST/_config/admins/admin -d '"admin"'

# create the piggybank user 
# now that an admin user exists, change the host
HOST="http://admin:admin@localhost:5984"
curl -X PUT $HOST/_config/admins/dashboard -d '"dashboard"'


# done!
echo
echo
echo "Installation complete!"
