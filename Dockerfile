# LPP Sports: statische Seite + PHP-Backend (api/plan.php)
# curl und json sind im offiziellen PHP-Image standardmaessig aktiv.
FROM php:8.3-apache

# mod_rewrite fuer die .htaccess-Regel (/api/plan -> plan.php)
# apache2-utils liefert htpasswd fuer den optionalen Basic-Auth-Schutz
RUN a2enmod rewrite \
    && apt-get update \
    && apt-get install -y --no-install-recommends apache2-utils \
    && rm -rf /var/lib/apt/lists/*

# .htaccess-Regeln erlauben (Standard von Apache ist AllowOverride None)
RUN sed -ri 's!AllowOverride None!AllowOverride All!g' /etc/apache2/apache2.conf

# Entrypoint und Auth-Vorlage (ausserhalb des Web-Roots)
COPY docker/docker-entrypoint.sh /usr/local/bin/lpp-entrypoint.sh
COPY docker/basic-auth.conf /opt/basic-auth.conf
RUN chmod +x /usr/local/bin/lpp-entrypoint.sh

# Projektdateien ins Web-Root
COPY . /var/www/html/

# Nicht ins Web-Root gehoerende Dateien entfernen
RUN rm -rf /var/www/html/docker /var/www/html/api/ki-config.php

EXPOSE 80
ENTRYPOINT ["/usr/local/bin/lpp-entrypoint.sh"]
