
install:
		bower install

karte:
		ogr2ogr -f GeoJSON \
						-s_srs "EPSG:31467" \
						-t_srs "EPSG:4326" \
						-where "GF = 4" \
						static/geo/land.geojson src/geo/land/VG250_LAN.shp
		ogr2ogr -f GeoJSON \
						-s_srs "EPSG:31467" \
						-t_srs "EPSG:4326" \
						static/geo/kreise.geojson src/geo/VG250_KRS_merged.shp
		topojson \
				--out static/geo/kreise.topojson \
				--id-property=AGS \
				-p name=GEN \
				-p cityname=NAME \
				-p mre_2013=+mre_2013 \
				-p mre_p_2013=+mre_p_2013 \
				-p mre_rank_2013=+mre_rank_2013 \
				-p mre_2012=+mre_2012 \
				-p mre_p_2012=+mre_p_2012 \
				-p mre_rank_2012=+mre_rank_2012 \
				-p mre_2011=+mre_2011 \
				-p mre_p_2011=+mre_p_2011 \
				-p mre_rank_2011=+mre_rank_2011 \
				-p mre_2010=+mre_2010 \
				-p mre_p_2010=+mre_p_2010 \
				-p mre_rank_2010=+mre_rank_2010 \
				-p mre_rise=+mrerise \
				-p esbl_2010=+esbl_2010 \
				-p esbl_p_2010=+esbl_p_2010 \
				-p esbl_rank_2010=+esbl_rank_2010 \
				-p esbl_2011=+esbl_2011 \
				-p esbl_p_2011=+esbl_p_2011 \
				-p esbl_rank_2011=+esbl_rank_2011 \
				-p esbl_2012=+esbl_2012 \
				-p esbl_p_2012=+esbl_p_2012 \
				-p esbl_rank_2012=+esbl_rank_2012 \
				-p esbl_2013=+esbl_2013 \
				-p esbl_p_2013=+esbl_p_2013 \
				-p esbl_rank_2013=+esbl_rank_2013 \
				-p esbl_rise=+esblrise \
				-p vre_2010=+vre_2010 \
				-p vre_p_2010=+vre_p_2010 \
				-p vre_rank_2010=+vre_rank_2010 \
				-p vre_2011=+vre_2011 \
				-p vre_p_2011=+vre_p_2011 \
				-p vre_rank_2011=+vre_rank_2011 \
				-p vre_2012=+vre_2012 \
				-p vre_p_2012=+vre_p_2012 \
				-p vre_rank_2012=+vre_rank_2012 \
				-p vre_2013=+vre_2013 \
				-p vre_p_2013=+vre_p_2013 \
				-p vre_rank_2013=+vre_rank_2013 \
				-p vre_rise=+vrerise \
				-p mrsa_2010=+mrsa_2010 \
				-p mrsa_p_2010=+mrsa_p_2010 \
				-p mrsa_rank_2010=+mrsa_rank_2010 \
				-p mrsa_2011=+mrsa_2011 \
				-p mrsa_p_2011=+mrsa_p_2011 \
				-p mrsa_rank_2011=+mrsa_rank_2011 \
				-p mrsa_2012=+mrsa_2012 \
				-p mrsa_p_2012=+mrsa_p_2012 \
				-p mrsa_rank_2012=+mrsa_rank_2012 \
				-p mrsa_2013=+mrsa_2013 \
				-p mrsa_p_2013=+mrsa_p_2013 \
				-p mrsa_rank_2013=+mrsa_rank_2013 \
				-p mrsa_rise=+mrsarise \
				-p count=+count \
				-e src/mrsa/mrsa.csv \
				-q 2000 \
				-s 0.00000004 \
				static/geo/kreise.geojson \
				static/geo/land.geojson \
				src/geo/places/places.geojson

plz:
		rm -rf src/plz
		mkdir -p src/plz
		wget -O src/plz/postleitzahlen_v10_txt.zip "http://www.manfrin-it.com/postleitzahlen/postleitzahlen_v10_txt.zip"
		unzip -d src/plz/ src/plz/postleitzahlen_v10_txt.zip
		# un-BOM
		awk '{ if (NR==1) sub(/^\xef\xbb\xbf/,""); print }' src/plz/postleitzahlen_v10.txt > src/plz/plz.tsv
		csvcut -t -H -c column1,column3 src/plz/plz.tsv | sed "s/column1/plz/" | sed "s/column3/ags/" > static/geo/plz.csv

clean:
		@rm -f static/geo/kreise.geojson static/geo/land.geojson static/geo/kreise.topojson
		@rm -f static/js/keime.js static/css/keime.css

jsfiles = \
					static/vendor/jquery/dist/jquery.min.js \
					static/vendor/bootstrap.min.js \
					static/vendor/d3/d3.min.js \
					static/vendor/topojson/topojson.js \
					static/js/kreiskarte.js

cssfiles = \
					static/css/bootstrap.min.css \
					static/css/style.css

static/js/keime.js: ${jsfiles}
		uglifyjs -o $@ $^

static/css/keime.css: ${cssfiles}
		cat $^ > $@

build: static/js/keime.js static/css/keime.css karte
		mkdir -p ../apps.correctiv.org/keime/static/keime/geo
		mkdir -p ../apps.correctiv.org/keime/static/keime/js
		mkdir -p ../apps.correctiv.org/keime/static/keime/css
		cp static/js/keime.js ../apps.correctiv.org/keime/static/keime/js/keime.js
		cp static/css/keime.css ../apps.correctiv.org/keime/static/keime/css/keime.css
		cp static/geo/kreise.topojson ../apps.correctiv.org/keime/static/keime/geo/kreise.topojson
		cp static/geo/plz.csv ../apps.correctiv.org/keime/static/keime/geo/plz.csv
		cp -r static/font ../apps.correctiv.org/keime/static/keime/
		cp -r static/img ../apps.correctiv.org/keime/static/keime/
		tail +5 index.html > ../apps.correctiv.org/keime/templates/keime/_map_body.html
