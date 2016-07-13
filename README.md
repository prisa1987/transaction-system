
## A Simple Transaction / Accounting System.

Built to be used mainly as an internal service.

```bash
# Install modules
npm i

# Setup database
mysql -u root -p <your root pass> < ./sql/db.sql

# Set the following environment variables, e.g.
# in ~/.profile or ~/.bashrc

# Export everything
set -a

TRANSACT_HOST="dev.api.com"
TRANSACT_PORT=3991

TRANSACT_API_SECRET="change-secret-to-something-better-68000"

# Note that TLS is a requirement in production !
TRANSACT_TLS_CERT="path/to/domain.com.crt"
TRANSACT_TLS_PRIVKEY="path/to/domain.com.key"

TRANSACT_MYSQL_DB="transact_dev"
TRANSACT_MYSQL_USER="transact"
TRANSACT_MYSQL_PASS="transact"

set +a

# Finally start the server
npm start
```

## Usage:

### 1. Create an account.

```bash
# Curl FTW.

# Create user `Ace` with email `ace@base.se`
curl -X POST -d 'name=Ace&email=ace@base.se' http://dev.api.com:3991/api/user

# Response
{
  "user":{
    "id":"17",
    "name":"Ace",
    "email":"ace@base.se",
    "created":"2016-06-11T07:24:15.000Z",
    "password":"ryHD1BYN" # automatically generated password
  }
}
```

### 2. Authenticate and get an access token.

```bash
# Authenticate user using email and password
curl -X POST -d 'email=ace@base.se&password=ryHD1BYN' http://dev.api.com:3991/api/auth

# Response
{ "token":"eyJhbGci..." }
```

### 3. Create an account for a given currency.

```bash
# NOTE: Requires an access token.
# Choose a currency like USD, SEK etc.
curl -H 'Authorization: eyJhbGci...' -X POST -d 'currency=USD' http://dev.api.com:3991/api/account

# Response
{
  "account":{
    "id":"10092",
    "userId":"17",
    "name":"USD_1",
    "type":1,
    "isInternal":0,
    "created":"2016-06-11T09:54:52.000Z",
    "balance":"0",
    "currency":"USD"
  }
}
```

### 4. Deposit funds.

```bash
node cli/admin.js --deposit --accountId 10092 --currency USD --amount 2000

# Response
Transaction: {
  id: '3568',
  fromAccountId: '101',   # System account.
  toAccountId: '10092',
  amount: '2000',         # Amount in US cents.
  created: 2016-06-11T10:24:18.000Z,
  type: 1                 # Real (non-test) transaction.
}
```

### 5. Transfer funds.

```bash
# Transfer 1 US cent from one USD account to another.
# NOTE: We assume that account 10093 was created previously.
curl -H 'Authorization: eyJhbGci...' -X POST -d 'fromAccountId=10092&toAccountId=10093&amount=1&currency=USD' http://dev.api.com:3991/api/transfer

# Response
{
  "transactionHistory": {
    "id":"3792",
    "fromAccountId":"10092",
    "toAccountId":"10093",
    "amount":"1",
    "created":"2016-06-11T10:41:57.000Z",
    "type":1
  }
}    
```

### 6. Get transaction history.

```bash
# Fetch the 10 latest transaction history entries for account 10092
curl -H 'Authorization: eyJhbGci...' -X GET http://dev.api.com:3991/api/history/10092

# Fetch the 100 latest transaction history entries for account 10092
curl -H 'Authorization: eyJhbGci...' -X GET http://dev.api.com:3991/api/history/10092?max=100

# Response
{
  "transactionHistory": [{
    "id":"3792",
    "fromAccountId":"10092",
    "toAccountId":"10093",
    "amount":"1",
    "created":"2016-06-11T10:41:57.000Z",
    "type":1
  },
  { ... }],
}    
```

### 7. Fetch account info, including current balance.

```bash
curl -H 'Authorization: eyJhbGci...' -X GET http://dev.api.com:3991/api/account/10092

# Response
{
  "account":{
    "id":"10092",
    "userId":"17",
    "name":"USD_1",
    "type":1,
    "isInternal":0,
    "created":"2016-06-11T09:54:52.000Z",
    "balance":"1999",
    "currency":"USD"
  }
}
```

## Additional API endpoints.

```bash
# List all accounts.
curl -H 'Auth..' -X GET http://dev.api.com:3991/api/accounts

# Update user profile.
# Allowed fields;
#   first_name: Joi.string().max(128),
#   last_name: Joi.string().max(128),
#   photo: Joi.string().max(1024),
#   picture: Joi.string().max(1024),
#   settings: Joi.string().max(1024)
curl -H 'Auth..' -X PATCH -d 'first_name=Massa&last_name=Mun' \
http://dev.api.com:3991/api/user/profile

# Search for a user by exact email.
curl -H 'Auth..' -X POST -d 'query=ace@base.se' \
http://dev.api.com:3991/api/search/user

# Search for a user whose first or last name begins with `Ma`,
# among all users to which you’ve recently sent money.
curl -H 'Auth..' -X POST -d 'query=Ma' \
http://dev.api.com:3991/api/search/user
```
