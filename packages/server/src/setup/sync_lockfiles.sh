#!/bin/sh
MAIN_LOCK=/usr/src/app/Gemfile.lock

# Extraer plataformas del lockfile principal
PLATFORMS=$(awk '/^PLATFORMS/{f=1;next} f&&/^[A-Z]/{f=0} f{gsub(/^  /,"");print}' "$MAIN_LOCK")

# Extraer version de Ruby del lockfile principal
RUBY_VER=$(awk '/^RUBY VERSION/{f=1;next} f&&/^[A-Z]/{f=0} f{gsub(/^  /,"");print;exit}' "$MAIN_LOCK")

if [ -z "$PLATFORMS" ]; then
  echo "No se encontraron plataformas en el lockfile principal, omitiendo sincronizacion."
  exit 0
fi

echo "Plataformas detectadas: $PLATFORMS"
echo "Ruby version detectada: $RUBY_VER"

# Funcion que parchea un lockfile dado
patch_lockfile() {
  LOCK="$1"
  [ -f "$LOCK" ] || return
  # Parchar PLATFORMS
  awk -v plats="$PLATFORMS" '
    /^PLATFORMS/{
      print "PLATFORMS"
      n=split(plats,a,"\n")
      for(i=1;i<=n;i++) if(a[i]!="") print "  "a[i]
      skip=1; next
    }
    skip && /^[A-Z]/{skip=0}
    !skip{print}
  ' "$LOCK" > "$LOCK.tmp" && mv "$LOCK.tmp" "$LOCK"
  # Parchar RUBY VERSION si existe en el lockfile
  if grep -q "^RUBY VERSION" "$LOCK" && [ -n "$RUBY_VER" ]; then
    awk -v rv="$RUBY_VER" '
      /^RUBY VERSION/{
        print "RUBY VERSION"
        print "   "rv
        skip=1; next
      }
      skip && /^[A-Z]/{skip=0}
      !skip{print}
    ' "$LOCK" > "$LOCK.tmp" && mv "$LOCK.tmp" "$LOCK"
  fi
  echo "   -> Parcheado: $LOCK"
}

# Lockfiles raiz
patch_lockfile /usr/src/app/Gemfile.rails80.plugins.lock
patch_lockfile /usr/src/app/Gemfile.d/rubocop.rb.lock

# Todos los lockfiles de sub-gemas
for LOCK in /usr/src/app/gems/*/Gemfile.lock; do
  patch_lockfile "$LOCK"
done

echo "Sincronizacion de plataformas y version Ruby completada en todos los lockfiles."
