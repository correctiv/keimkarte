
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
				--id-property=+AGS \
				-p name=GEN \
				-p mre=+mre \
				-p mre_p=+mre_p \
				-p mre_rank=+mre_rank \
				-p esbl=+esbl \
				-p esbl_p=+esbl_p \
				-p esbl_rank=+esbl_rank \
				-p vre=+vre \
				-p vre_p=+vre_p \
				-p vre_rank=+vre_rank \
				-p mrsa=+mrsa \
				-p mrsa_p=+mrsa_p \
				-p mrsa_rank=+mrsa_rank \
				-p mrerise=+mrerise \
				-p count=+count \
				-e src/mrsa/mrsa.csv \
				-q 2000 \
				-s 0.00000004 \
				static/geo/kreise.geojson \
				static/geo/land.geojson

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
