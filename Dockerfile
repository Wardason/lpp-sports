# LPP Sports: statische Seite + PHP-Backend (api/plan.php)
# curl und json sind im offiziellen PHP-Image standardmaessig aktiv.
FROM php:8.3-apache

# mod_rewrite fuer die .htaccess-Regel (/api/plan -> plan.php)
RUN a2enmod rewrite

# .htaccess-Regeln erlauben (Standard von Apache ist AllowOverride None)
RUN sed -ri 's!AllowOverride None!AllowOverride All!g' /etc/apache2/apache2.conf

# Projektdateien ins Web-Root
COPY . /var/www/html/

# Sicherheitsnetz: echte Config gehoert nie ins Image (Key kommt per ENV in Coolify)
RUN rm -f /var/www/html/api/ki-config.php

EXPOSE 80
