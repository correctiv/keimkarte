(function(window){
  'use strict';

  d3.selection.prototype.moveToFront = function() {
    return this.each(function(){
      this.parentNode.appendChild(this);
    });
  };

  function getQueryObject() {
    var query = window.location.search.substring(1);
    var qobj = {};
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
      var pair = vars[i].split('=');
      qobj[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
    }
    return qobj;
  }

  function Kreiskarte(options) {
    options = options || {};
    var defaultOptions = {
      containerId: 'vis',
      topojsonFile: 'static/geo/kreise.topojson',
      plzFile: 'static/geo/plz.csv',
      plzInput: 'plz-input',
      bounds: [],
      baseScale: 7.5,
      defaultDataKey: 'mrerise',
      dimensions: {
        mrerise: {
          key: 'mrerise',
          label: 'Anstieg MRE 2010 - 2013',
          range: ["#276419", "#4d9221", "#7fbc41", "#b8e186", "#e6f5d0", "#f7f7f7", "#fde0ef", "#f1b6da", "#de77ae", "#c51b7d", "#8e0152"],
          domain: [-300, -200, -100, 0, 100, 200, 300],
          scale: 'quantize'
        },
        mrsa: {
          key: 'mrsa_p',
          label: 'MRSA-Fälle pro 1000 Patienten',
          range: ["#edf8fb","#bfd3e6","#9ebcda","#8c96c6","#8c6bb1","#88419d","#6e016b"],
          scale: 'quantize'
        },
        esbl: {
          key: 'esbl_p',
          label: 'ESBL-Fälle pro 1000 Patienten',
          range: ["#edf8fb","#bfd3e6","#9ebcda","#8c96c6","#8c6bb1","#88419d","#6e016b"],
          scale: 'quantize'
        },
        vre: {
          key: 'vre_p',
          label: 'VRE-Fälle pro 1000 Patienten',
          range: ["#edf8fb","#bfd3e6","#9ebcda","#8c96c6","#8c6bb1","#88419d","#6e016b"],
          scale: 'quantize'
        },
        mre: {
          key: 'mre_p',
          label: 'MRE-Fälle pro 1000 Patienten',
          range: ["#edf8fb","#bfd3e6","#9ebcda","#8c96c6","#8c6bb1","#88419d","#6e016b"],
          scale: 'quantize'
        }
      },
      placeholders: ['mre', 'mre_p', 'mre_rank', 'mrerise',
                    'mrsa_p', 'mrsa_rank',
                    'esbl_p', 'esbl_rank',
                    'vre_p', 'vre_rank']
    };
    this.options = {};
    for (var k in defaultOptions) {
      this.options[k] = options[k] === undefined ? defaultOptions[k] : options[k];
    }

    this.activated = null;
    this.dataKey = this.options.defaultDataKey;
    this.kreisColor = {};
    this.maxCache = {};
  }

  Kreiskarte.prototype.init = function(){
    var domContainer = document.getElementById(this.options.containerId);
    this.container = d3.select('#' + this.options.containerId);
    this.width = domContainer.offsetWidth;
    this.height = domContainer.offsetHeight;
    this.dim = Math.min(this.width, this.height);
    this.unit = this.dim / 400;
    this.minHeight = 400;

    var self = this;
    for (var dim in this.options.dimensions) {
      d3.select('#dimension-selection').append('option')
        .attr('value', dim).text(this.options.dimensions[dim].label);
    }
    d3.select('#dimension-selection').on('input', function(){
      self.dataKey = this.value;
      self.updateMap();
    });

    this.kreisCircle = d3.scale.sqrt()
      .range([0, 15/756 * this.dim]);

    this.root = this.container.append('svg')
      .attr({
        width: this.width,
        height: this.height
      });
    this.svg = this.root.append('g')
      .attr('id', 'world');

    this.projection = d3.geo.albers()
      .center([0, 51])
      .rotate([-10.4, 0])
      .scale(this.options.baseScale * this.dim)
      .translate([this.width / 5 * 2, this.height / 2])
      .precision(0.1);

    this.path = d3.geo.path()
      .projection(this.projection);

    d3.json(this.options.topojsonFile, this.drawMap.bind(this));
    d3.csv(this.options.plzFile, this.processPostcodes.bind(this));
  };

  Kreiskarte.prototype.postInit = function() {
    if (!(this.features && this.plz)) {
      return false;
    }

    var self = this;

    var queryObject = getQueryObject();
    if (queryObject.kreis) {
      this.activateKreis(queryObject.kreis);
    } else if (queryObject.zoom) {
      this.showZoom(queryObject.zoom);
    } else {
      history.pushState({}, "", ".");
    }

    window.onpopstate = function(event) {
      if (!event.state) { return; }

      if (event.state.kreis) {
        self.activateKreis(event.state.kreis, true);
      } else if (event.state.zoom) {
        self.deactivateKreis();
        self.showZoom(event.state.zoom);
      } else {
        self.deactivateKreis();
      }
    };
  };

  Kreiskarte.prototype.drawMap = function(error, kreise) {
    var self = this;

    this.features = topojson.feature(kreise, kreise.objects.kreise).features;

    this.maxCache.min_count = d3.min(this.features, function(d) { return d.properties.count; });
    this.maxCache.max_count = d3.max(this.features, function(d) { return d.properties.count; });

    this.kreisCircle.domain([
      this.maxCache.min_count,
      this.maxCache.max_count]);

    this.kreise = this.svg.append('g')
      .attr('class', 'kreise');

    var get = function(dim) {
      return function(d) { return d.properties[dim]; };
    };
    for (var dim in this.options.dimensions) {
      var dimension = this.options.dimensions[dim];
      this.kreisColor[dim] = d3.scale[dimension.scale]()
        .range(dimension.range);
      if (dimension.domain) {
        this.kreisColor[dim].domain(dimension.domain);
      } else {
        this.kreisColor[dim].domain([
          d3.min(this.features, get(dimension.key)),
          d3.max(this.features, get(dimension.key))]);
      }
    }

    this.kreise.append('path')
      .datum(topojson.mesh(kreise, kreise.objects.land, function(a, b) { return a === b; }))
      .attr('d', this.path)
      .attr('class', 'staat-grenze');

    this.kreise
      .selectAll('.kreis')
      .data(this.features)
      .enter().append('path')
      .attr('class', function(d) { return 'kreis kreis-' + d.id; })
      .attr('title', function(d) { return d.name; })
      .attr('d', this.path)
      .on('click', function(d){
        self.activateKreis(d.id);
      });

    this.kreise.append('path')
      .datum(topojson.mesh(kreise, kreise.objects.land, function(a, b) { return a !== b; }))
      .attr('d', this.path)
      .attr('class', 'land-grenze');

    this.kreise.append('path')
      .datum(topojson.mesh(kreise, kreise.objects.kreise, function(a, b) { return a !== b; }))
      .attr('d', this.path)
      .attr('class', 'kreis-grenze');

    this.dorling = this.svg.append('g')
      .attr('class', 'dorling');
    this.dorling.selectAll('.kreis-circle').data(this.features).enter()
      .append('circle')
      .attr('class', function(d) { return 'kreis-circle kreis-circle-' + d.id; })
      .each(function(d) {
        d.properties.c = self.path.centroid(d);
        d.properties.x = 400;
        d.properties.y = 300;
      })
      .attr('cx',function(d) { return d.properties.x + d.properties.c[0] - 400; })
      .attr('cy',function(d) { return d.properties.y + d.properties.c[1] - 300; })
      .on('click', function(d){
        self.activateKreis(d.id);
      });

    this.updateMap();
    this.postInit();
  };

  Kreiskarte.prototype.updateMap = function() {
    var self = this;

    var dimension = this.options.dimensions[this.dataKey];
    var kreisColor;
    kreisColor = this.kreisColor[this.dataKey];

    this.kreise.selectAll('.kreis')
      .style('fill', function(d){
        if (d.properties[dimension.key] !== null) {
          return kreisColor(d.properties[dimension.key]);
        } else {
          return 'none';
        }
    });

    this.dorling.selectAll('.kreis-circle')
      // .style('fill', function(d){
      //   return kreisColor(d.properties[dimension.key]);
      // })
      .attr('r', function(d) {
        return self.kreisCircle(d.properties.count);
      });

  };

  Kreiskarte.prototype.processPostcodes = function(error, data) {
    var self = this;
    this.plz = {};
    for (var i = 0; i < data.length; i += 1) {
      this.plz[data[i].plz] = +data[i].ags;
    }
    d3.select('.plz-search').style('visibility', 'visible');
    this.plzInput = d3.select('.' + this.options.plzInput);
    this.plzInput.on('input', function() {
      self.plzSearch(this.value);
    });
    this.postInit();
  };

  Kreiskarte.prototype.plzSearch = function(plz) {
    if (plz.length != 5) {
      return false;
    }
    var kreis = this.plz[plz];
    if (kreis === undefined) {
      d3.select('.' + this.options.plzInput).classed('wrong', true);
      this.deactivateKreis();
      return false;
    }
    this.deactivateKreis(true);
    d3.select('.' + this.options.plzInput).classed('wrong', false);
    this.activateKreis(kreis);
  };

  Kreiskarte.prototype.activateKreis = function(kreis, noHistory) {
    var elem = this.svg.select('.kreis-' + kreis);
    var d = this.svg.select('.kreis-' + kreis).data()[0];
    if (d && d !== this.activated) {
      if (!noHistory) {
        history.pushState({kreis: kreis}, "Kreis " + kreis, "?kreis=" + kreis);
      }
      elem.moveToFront();
      this.activated = d;
      this.svg.selectAll('.kreis').classed('active', false);
      this.svg.selectAll('.kreis-circle').classed('active', false);
      this.svg.selectAll('.kreis-' + kreis).classed('active', true);
      this.svg.selectAll('.kreis-circle-' + kreis).classed('active', true);
      this.zoomToBounds(d);
      d3.select('.kreis-info').style('display', 'block');
      d3.select('.kreis-name').text(d.properties.name);
      for (var i = 0; i < this.options.placeholders.length; i++) {
        var placeholder = this.options.placeholders[i];
        d3.select('.' + placeholder).text(Math.round(d.properties[placeholder]));
      }
      if (d.properties.mrerise < 0) {
        d3.select('.mrerise-label').text('verringert');
      } else if (d.properties.mrerise > 0) {
        d3.select('.mrerise-label').text('erhöht');
      } else {
        d3.select('.mrerise-label').text('verändert');
      }
      if (d.properties.mrerise === null) {
        d3.select('.mrerise-section').style('display', 'none');
      } else {
        d3.select('.mrerise-section').style('display', 'inline');
      }
      d3.select('.mrsa_p').attr('title', d.properties.mrsa + ' Fälle');
      d3.select('.vre_p').attr('title', d.properties.vre + ' Fälle');
      d3.select('.esbl_p').attr('title', d.properties.esbl + ' Fälle');
      d3.select('.mrsa-color').style('background-color', this.kreisColor.mrsa(d.properties.mrsa_p));
      d3.select('.esbl-color').style('background-color', this.kreisColor.esbl(d.properties.esbl_p));
      d3.select('.vre-color').style('background-color', this.kreisColor.vre(d.properties.vre_p));
    }
  };

  Kreiskarte.prototype.deactivateKreis = function(noHistory) {
    if (!this.activated) { return; }
    this.activated = null;
    this.svg.selectAll('.kreis').classed('active', false);
    this.svg.selectAll('.kreis-circle').classed('active', false);
    d3.select('.kreis-info').style('display', 'none');
    this.zoomToBounds();
    if (!noHistory) {
      history.pushState({}, "", ".");
    }
  };

  Kreiskarte.prototype.showZoom = function(kreis, noHistory) {
    var d = this.svg.select('.kreis-' + kreis).data()[0];
    if (!noHistory) {
      history.pushState({zoom: kreis}, "Kreis " + kreis, "?zoom=" + kreis);
    }
    this.zoomToBounds(d);
  };

  Kreiskarte.prototype.zoomToBounds = function(d) {
    var x, y, k, tw, th;
    if (d) {
      var centroid = this.path.centroid(d);
      x = centroid[0];
      y = centroid[1];
      k = 5;
      tw = this.width / 5 * 2;
      th = this.height / 5 * 2;
      this.svg.classed('zoomed', true);
    } else {
      x = this.width / 2;
      y = this.height / 2;
      k = 1;
      tw = this.width / 2;
      th = this.height / 2;
      this.svg.classed('zoomed', false);
    }

    this.svg.transition()
        .duration(750)
        .attr('transform', 'translate(' + tw + ',' + th + ')scale(' + k + ')translate(' + -x + ',' + -y + ')')
        .style('stroke-width', 1.5 / k + 'px');
  };

  window.Kreiskarte = Kreiskarte;

}(window));
