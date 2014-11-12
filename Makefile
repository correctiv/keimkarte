
install:
		bower install

karte:
		@ogr2ogr -f GeoJSON \
						-s_srs "EPSG:31467" \
						-t_srs "EPSG:4326" \
						static/geo/kreise.geojson src/VG250_KRS_merged.shp
		@topojson --id-property=AGS \
							-p name=GEN \
							-p value=+diagnosen_pro_1000 \
							-p count=+patienten_2013 \
							-e src/mrsa.csv \
							--out static/geo/kreise.topojson \
							-q 2000 \
							-s 0.00000004 \
							static/geo/kreise.geojson

clean:
		@rm static/geo/kreise.geojson static/geo/kreise.topojson
