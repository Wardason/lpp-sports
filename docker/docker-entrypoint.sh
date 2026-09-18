#!/bin/sh
set -e

# Basic Auth aktivieren, sobald Zugangsdaten als Environment-Variablen da sind.
# Passwort bleibt so aus dem Repo raus und wird von Coolify injiziert.
AUTH_CONF=/etc/apache2/conf-enabled/lpp-basic-auth.conf

if [ -n "${BASIC_AUTH_USER}" ] && [ -n "${BASIC_AUTH_PASSWORD}" ]; then
    htpasswd -bBc /etc/apache2/.htpasswd "${BASIC_AUTH_USER}" "${BASIC_AUTH_PASSWORD}" >/dev/null 2>&1
    cp /opt/basic-auth.conf "${AUTH_CONF}"
    echo "[entrypoint] Basic Auth aktiv fuer Benutzer ${BASIC_AUTH_USER}"
else
    rm -f "${AUTH_CONF}" /etc/apache2/.htpasswd
    echo "[entrypoint] Basic Auth aus (keine BASIC_AUTH_* Variablen gesetzt)"
fi

exec apache2-foreground
