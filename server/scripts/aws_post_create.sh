#!/usr/bin/env bash

# start up couch db to add users
sudo service couchdb start

# curl will fail without a delay
#sleep 10

# create an admin user
#HOST="http://localhost:5984"
#curl -X PUT $HOST/_config/admins/admin -d '"admin"'

# create the piggybank user 
# now that an admin user exists, change the host
#HOST="http://admin:admin@localhost:5984"
#curl -X PUT $HOST/_config/admins/kpiggybank -d '"kpiggybank"'

# create the kpi db
#curl -X PUT $HOST/bid_kpi
