(function(window){
  'use strict';

  function Kreiskarte(options) {
    options = options || {};
    var defaultOptions = {
      containerId: 'vis',
      topojsonFile: 'static/geo/kreise.topojson'
    };
    this.options = {};
    for (var k in defaultOptions) {
      this.options[k] = options[k] === undefined ? defaultOptions[k] : options[k];
    }
  }

  Kreiskarte.prototype.init = function(){
    var domContainer = document.getElementById(this.options.containerId);
    this.container = d3.select('#' + this.options.containerId);
    this.width = domContainer.offsetWidth;
    this.height = domContainer.offsetHeight;

    this.kreisColor = d3.scale.linear()
      .range(["#a1d76a", "#e9a3c9"]);
    this.kreisCircle = d3.scale.sqrt()
      .range([0, 15]);

    this.root = this.container.append('svg')
      .attr({
        width: this.width,
        height: this.height
      });
    this.svg = this.root.append("g")
      .attr("id", "world");

    this.projection = d3.geo.albers()
      .center([0, 51.330612])
      .rotate([-10.4, 0])
      .scale(4600)
      .translate([this.width / 2, this.height / 2])
      .precision(0.1);

    this.path = d3.geo.path()
      .projection(this.projection);

    d3.json(this.options.topojsonFile, this.drawMap.bind(this));

  };

  Kreiskarte.prototype.drawMap = function(error, kreise) {
    var self = this;

    var features = topojson.feature(kreise, kreise.objects.kreise).features;

    this.kreisColor.domain([
      d3.min(features, function(d) { return d.properties.value; }),
      d3.max(features, function(d) { return d.properties.value; })]);
    this.kreisCircle.domain([
      d3.min(features, function(d) { return d.properties.count; }),
      d3.max(features, function(d) { return d.properties.count; })]);

    this.kreise = this.svg.append('g')
      .attr('class', 'kreise');

    this.kreise.append("path")
      .datum(topojson.mesh(kreise, kreise.objects.kreise, function(a, b) { return a !== b; }))
      .attr("d", this.path)
      .attr("class", "kreis-grenze");

    this.kreise
      .selectAll('path')
      .data(features)
      .enter().append('path')
      .attr('class', function(d) { return 'kreis kreis-' + d.id; })
      .attr('title', function(d) { return d.name; })
      .attr('d', this.path)
      .style('fill', function(d){
        return self.kreisColor(d.properties.value);
      })
      .on('mouseover', function(d){
        console.log('tut', d.properties);
      })
      .on('click', function(d){
        self.zoomToBounds(d);
      });


    this.dorling = this.svg.append('g')
      .attr('class', 'dorling');
    this.dorling.selectAll(".kreis-circle").data(features).enter()
      .append("circle")
      .attr('class', function(d) { return 'kreis-circle kreis-circle-' + d.id; })
      .each(function(d) {
        // use sqrt root to correct map value into area
        d.properties.r = self.kreisCircle(d.properties.count);
        d.properties.c = self.path.centroid(d);
        d.properties.x = 400;
        d.properties.y = 300;
      })
      .attr("cx",function(d) { return d.properties.x + d.properties.c[0] - 400; })
      .attr("cy",function(d) { return d.properties.y + d.properties.c[1] - 300; })
      .attr("r", function(d) { return d.properties.r;})
      .style('fill', function(d){
        return self.kreisColor(+d.properties.value);
      })
      .on('mouseover', function(d){
        console.log('tut', d.properties);
      })
      .on('click', function(d){
        self.zoomToBounds(d);
      });
  };

  Kreiskarte.prototype.zoomToBounds = function(d) {
    var x, y, k;
    if (d && d !== this.centered) {
      var centroid = this.path.centroid(d);
      x = centroid[0];
      y = centroid[1];
      k = 3;
      this.centered = d;
    } else {
      x = this.width / 2;
      y = this.height / 2;
      k = 1;
      this.centered = null;
    }

    this.svg.transition()
        .duration(750)
        .attr("transform", "translate(" + this.width / 2 + "," + this.height / 2 + ")scale(" + k + ")translate(" + -x + "," + -y + ")")
        .style("stroke-width", 1.5 / k + "px");
  };

  window.Kreiskarte = Kreiskarte;

}(window));
