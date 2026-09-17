#!/usr/bin/env bash
# Maaler enhver offentlig flade paa begge vaerter. Koeres efter HVERT deploy.
#
# Baggrund: i S592 maalte jeg kun apex og meldte groent. www.vendhjem.dk/internt
# laa aabent i et doegn med BBR-data og oekonomi frit laesbart. Access var bundet
# til vendhjem.dk-stier; www er en anden vaert og var ikke daekket.
#
# Laeren er ikke «husk www». Den er: en flade, der ikke er maalt, er ikke sikker.
# Tilfoej nye vaerter og stier her, ikke i hukommelsen.

set -u
FEJL=0
VAERTER=(vendhjem.dk www.vendhjem.dk)
OFFENTLIG=(/ /sporene /fundamentet /maend /bliv-en-del /privatlivspolitik /cookies)
INTERN=(/internt /internt/ /internt/stedet /internt/oekonomi /internt/timer /internt/anlaeg /internt/registrering /internt/fonde/)
HEMMELIGT=("60.922" "asbest" "21.333" "148,5" "Rum for rum")

kode() { curl -s -o /dev/null -w "%{http_code}" "https://$1$2"; }

echo "── Interne stier skal ALDRIG svare 200 ──"
for v in "${VAERTER[@]}"; do
  for p in "${INTERN[@]}"; do
    c=$(kode "$v" "$p")
    if [ "$c" = "200" ]; then echo "  FEJL  $v$p svarer 200 — skulle vaere bag login"; FEJL=1
    else echo "  ok    $v$p -> $c"; fi
  done
done

echo "── Intet internt indhold maa kunne hentes, heller ikke via redirects ──"
for v in "${VAERTER[@]}"; do
  for p in "${INTERN[@]}"; do
    h=$(curl -sL "https://$v$p")
    for n in "${HEMMELIGT[@]}"; do
      if echo "$h" | grep -q "$n"; then echo "  FEJL  $v$p laekker «$n»"; FEJL=1; fi
    done
  done
done
echo "  (ingen FEJL over = intet laekket)"

echo "── Offentlige sider skal svare ──"
for p in "${OFFENTLIG[@]}"; do
  c=$(kode vendhjem.dk "$p")
  if [ "$c" != "200" ]; then echo "  FEJL  vendhjem.dk$p -> $c"; FEJL=1; else echo "  ok    vendhjem.dk$p -> 200"; fi
done

echo "── Sundhedstjek: bindings i produktion ──"
if [ -f /tmp/.vh_sundhed ]; then
  H=$(curl -s -H "X-VH-Sundhed: $(cat /tmp/.vh_sundhed)" "https://vendhjem.dk/sundhed/fonde")
  if echo "$H" | grep -q '"d1": "ok"' && echo "$H" | grep -q '"r2": "ok"'; then
    echo "  ok    D1 og R2 svarer fra Workeren"
  else
    echo "  FEJL  sundhedstjek: $H"; FEJL=1
  fi
  # og den maa ikke svare uden noeglen
  c=$(kode vendhjem.dk "/sundhed/fonde")
  if [ "$c" != "404" ]; then echo "  FEJL  /sundhed/fonde svarer $c uden noegle — skal vaere 404"; FEJL=1
  else echo "  ok    /sundhed/fonde -> 404 uden noegle"; fi
else
  echo "  sprunget over — noeglen findes ikke lokalt (hent «Vendhjem sundhedsnoegle» fra Bitwarden)"
fi

echo "── workers.dev skal vaere lukket ──"
c=$(kode vendhjem.steven-e91.workers.dev "/internt/")
if [ "$c" = "200" ]; then echo "  FEJL  workers.dev er aaben igen — tjek workers_dev = false"; FEJL=1
else echo "  ok    workers.dev -> $c"; fi

echo
[ $FEJL -eq 0 ] && echo "ALLE FLADER OK" || echo "DER ER HULLER — se FEJL ovenfor"
exit $FEJL
