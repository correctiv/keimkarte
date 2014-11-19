(function(window){
  'use strict';

  d3.selection.prototype.moveToFront = function() {
    return this.each(function(){
      this.parentNode.appendChild(this);
    });
  };

  var isTouch = function() {
    return ('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch;
  };

  var genericGetHTML = function(d) {
    return Math.round(d.properties[this.key]) + ' ' + this.label;
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
      topojsonFile: 'geo/kreise.topojson',
      staticPath: 'static/',
      plzInput: 'plz-input',
      bounds: [],
      noControls: false,
      baseScale: 7.3,
      defaultDataKey: 'mre',
      defaultYear: '2013',
      scales: {
        p1000: ['mrsa', 'vre', 'esbl']
      },
      dimensions: {
        mre_rise: {
          key: 'mre_rise',
          label: 'Veränderung MRE 2010 - 2013',
          range: ["#b8e186", "#e6f5d0", "#fde0ef", "#f1b6da", "#de77ae", "#c51b7d", "#8e0152"],
          domain: [-100, 0, 100, 200, 300],
          scale: 'quantize',
          makeLabel: function(d){ return d + '%'; },
          getHTML: function(d) {return d.properties.mre_rise > 0 ?
                                    d.properties.mre_rise + '% MRE-Anstieg' :
                                    d.properties.mre_rise + '% MRE-Verringerung';}
        },
        mre: {
          key: 'mre_p',
          label: 'MRE-Fälle pro 1000 Patienten',
          range: ["#edf8fb","#bfd3e6","#9ebcda","#8c96c6","#8c6bb1","#88419d","#6e016b"],
          scale: 'quantize',
          scaleId: 'p1000',
          domain: [0],
          getHTML: genericGetHTML,
          years: [2010, 2011, 2012, 2013]
        },
        mrsa: {
          key: 'mrsa_p',
          label: 'MRSA-Fälle pro 1000 Patienten',
          range: ["#edf8fb","#bfd3e6","#9ebcda","#8c96c6","#8c6bb1","#88419d","#6e016b"],
          scale: 'quantize',
          scaleId: 'p1000',
          domain: [0],
          getHTML: genericGetHTML
        },
        esbl: {
          key: 'esbl_p',
          label: 'ESBL-Fälle pro 1000 Patienten',
          range: ["#edf8fb","#bfd3e6","#9ebcda","#8c96c6","#8c6bb1","#88419d","#6e016b"],
          scale: 'quantize',
          scaleId: 'p1000',
          domain: [0],
          getHTML: genericGetHTML
        },
        vre: {
          key: 'vre_p',
          label: 'VRE-Fälle pro 1000 Patienten',
          range: ["#edf8fb","#bfd3e6","#9ebcda","#8c96c6","#8c6bb1","#88419d","#6e016b"],
          scale: 'quantize',
          scaleId: 'p1000',
          domain: [0],
          getHTML: genericGetHTML
        }
      },
      placeholders: ['mre_2013', 'mre_p_2013', 'mre_rank_2013', 'mre_rise',
                    'mrsa_p', 'mrsa_rank', 'mrsa_rise',
                    'esbl_p', 'esbl_rank', 'esbl_rise',
                    'vre_p', 'vre_rank', 'vre_rise']
    };
    this.options = {};
    for (var k in defaultOptions) {
      this.options[k] = options[k] === undefined ? defaultOptions[k] : options[k];
    }

    this.activated = null;
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

    // Copy over html to modal
    $('#kreis-modal .modal-body').html($('.modal-copy').html());

    var self = this;
    d3.selectAll('.key-btns .btn').on('click', function(){
      d3.event.preventDefault();
      self.state.key = $(this).data('key');
      if (self.state.key !== 'mre') {
        self.state.jahr = '';
      } else {
        self.state.jahr = $('.yearslider input').val();
      }
      self.updateMap();
      self.updateState();
    });

    d3.selectAll('.yearslider input').on('input', function(){
      self.state.jahr = this.value;
      self.updateMap();
      self.updateState();
    });


    this.kreisCircle = d3.scale.sqrt()
      .range([0, 15/756 * this.dim]);

    this.legend = d3.select('#legende').append('svg')
      .attr({
        width: '100%',
        height: 30
      });

    this.root = this.container.append('svg')
      .attr({
        width: this.width,
        height: this.height
      });
    this.svg = this.root.append('g')
      .attr('id', 'world');

    this.projection = d3.geo.albers()
      .center([0, 51.1])
      .rotate([-10.4, 0])
      .scale(this.options.baseScale * this.dim)
      .translate([this.width / 2, this.height / 2])
      .precision(0.1);

    this.path = d3.geo.path()
      .projection(this.projection);

    d3.json(this.options.staticPath + this.options.topojsonFile, function(error, data){
      self.drawMap(error, data);
    });
    d3.csv(this.options.staticPath + 'geo/plz.csv', function(error, data){
      self.processPostcodes(error, data);
    });
  };

  Kreiskarte.prototype.getValue = function(d, dim, year) {
    if (year && d.properties[dim + '_' + year] !== undefined) {
      return d.properties[dim + '_' + year];
    } else {
      return d.properties[dim];
    }
  };

  Kreiskarte.prototype.showPlaceholder = function(placeholder, elem) {
    if (!elem) {
      elem = this.activated;
    }
    if (placeholder.indexOf('mre_rise') !== -1) {
      return this.getValue(elem, 'mre_rise') + '%';
    }
    if (placeholder.indexOf('mre') !== -1) {
      return Math.round(this.getValue(elem, placeholder, this.state.jahr));
    }
    return Math.round(this.getValue(elem, placeholder));
  };

  Kreiskarte.prototype.showPlaceholderLabel = function(placeholder, elem) {
    var s = this.showPlaceholder(this.options.dimensions[placeholder].key, elem);
    return s+ ' ' +this.options.dimensions[placeholder].label;
  };


  Kreiskarte.prototype.postInit = function() {
    if (!(this.features && this.plz)) {
      return false;
    }

    var self = this;

    this.state = {
      key: this.options.defaultDataKey,
      jahr: this.options.defaultYear
    };

    var newState = getQueryObject();
    var changed = this.changeState(newState);

    window.onpopstate = function(event) {
      if (!event.state) { return; }
      self.changeState(event.state);
    };

    this.updateMap();

    $('#zoomout').click(function(){
      self.state.kreis = '';
      self.deactivateKreis();
      self.updateState();
    });
  };

  Kreiskarte.prototype.changeState = function(newState) {
    var changed = false;

    if (this.state.kreis !== newState.kreis) {
      this.state.kreis = newState.kreis;
      if (this.state.kreis) {
        delete this.state.zoom;
      }
      changed = true;
    }
    if (newState.zoom && this.state.zoom !== newState.zoom) {
      this.state.zoom = newState.zoom;
      this.showZoom(newState.zoom);
      changed = true;
    }
    if (newState.jahr && this.state.jahr !== newState.jahr) {
      this.state.jahr = newState.jahr;
      changed = true;
    }
    if (newState.key && this.state.key !== newState.key) {
      this.state.key = newState.key;
      d3.select('#key-selection option').attr('selected', null);
      d3.select('#option-' + this.state.key).attr('selected', true);
      changed = true;
    }

    if (changed) {
      this.activateKreis(this.state.kreis);
      this.updateMap();
    }

    this.updateControls();
    return changed;
  };

  Kreiskarte.prototype.getStateQueryString = function(change) {
    var queryString = [], val, path = [];
    for (var key in this.state) {
      if (change && change[key]) {
        val = change[key];
      } else {
        val = this.state[key];
      }
      if (val) {
        path.push(val);
        queryString.push(encodeURIComponent(key) + '=' + encodeURIComponent(val));
      }
    }
    return "?" + queryString.join('&');
  };

  Kreiskarte.prototype.updateState = function() {
    history.pushState(this.state, "Keimkarte", this.getStateQueryString());
    this.updateControls();
  };

  Kreiskarte.prototype.updateControls = function() {
    for (var dim in this.options.dimensions) {
      d3.selectAll('.' + dim + '-btn').attr('href', this.getStateQueryString({key: dim}));
    }
    d3.selectAll('.key-btns .btn').classed('btn-success', false);
    d3.selectAll('.key-btns .' + this.state.key + '-btn').classed('btn-success', true);

    if (this.state.jahr) {
      $('.yearslider input').val(this.state.jahr);
    }
    if (this.state.key === 'mre') {
      d3.selectAll('.yearslider').style('display', 'block');
    } else {
      d3.selectAll('.yearslider').style('display', 'none');
    }

    var shareUrl = window.encodeURIComponent(document.location.href);
    var shareText = document.title;
    if (this.activated) {
      shareText = window.encodeURIComponent(this.showPlaceholderLabel(this.state.key));
      d3.selectAll('.current').text(this.showPlaceholder(this.state.key));
      if (this.state.key !== 'mre_rise') {
        d3.selectAll('.current_label').text(this.showPlaceholderLabel(this.state.key));
        d3.selectAll('.current_p').text(this.showPlaceholder(this.state.key + '_p'));
        d3.selectAll('.current_rank').text(this.showPlaceholder(this.state.key + '_rank'));
      } else {
        d3.selectAll('.current_label').text(this.showPlaceholderLabel('mre_rise'));
        d3.selectAll('.current_p').text(this.showPlaceholder('mre_p_2013'));
        d3.selectAll('.current_rank').text(this.showPlaceholder('mre_rank_2013'));
      }
    } else {
      d3.selectAll('.current_label').text(this.options.dimensions[this.state.key].label);
    }
    d3.selectAll('.current_year').text(this.state.jahr || '2013');
    d3.selectAll('.facebook-share').attr('href',
      'https://www.facebook.com/sharer/sharer.php?u=' + shareUrl + '&t=' + shareText);
    d3.selectAll('.twitter-share').attr('href',
        'https://twitter.com/share?text=' + window.encodeURIComponent('@correctiv_org #keime') + '&url=' + shareUrl);
    d3.selectAll('.gplus-share').attr('href',
        'https://plus.google.com/share?url=' + shareUrl);
    d3.selectAll('.mail-share').attr('href',
        'mailto:?subject=' + shareText + '&body=' + shareUrl);
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
      var key = self.options.dimensions[dim].key;
      return function(d) {
        var years = self.options.dimensions[dim].years;
        if (years) {
          var m = -Infinity;
          for (var i = 0; i < years.length; i++) {
            m = Math.max(m, self.getValue(d, key, years[i]));
          }
          return m;
        } else {
          return self.getValue(d, key);
        }
      };
    };
    for (var dim in this.options.dimensions) {
      var dimension = this.options.dimensions[dim];
      if (dimension.scaleId && this.kreisColor[dimension.scaleId]) {
        this.kreisColor[dim] = this.kreisColor[dimension.scaleId];
        continue;
      }
      var scale = d3.scale[dimension.scale]()
        .range(dimension.range);
      if (dimension.domain) {
        if (dimension.domain.length === 1) {
          var arr = dimension.domain.slice();
          if (dimension.scaleId) {
            var members = this.options.scales[dimension.scaleId];
            var maxScale = -Infinity;
            for (var i = 0; i < members.length; i += 1) {
              maxScale = Math.max(maxScale, d3.max(this.features, get(this.options.scales[dimension.scaleId][i])));
            }
            arr.push(maxScale);
          } else {
            arr.push(d3.max(this.features, get(dimension.key)));
          }
          scale.domain(arr);
        } else {
          scale.domain(dimension.domain);
        }
      } else {
        scale.domain([
          d3.min(this.features, get(dimension.key)),
          d3.max(this.features, get(dimension.key))]);
      }
      this.kreisColor[dim] = scale;
      if (dimension.scaleId) {
        this.kreisColor[dimension.scaleId] = scale;
      }
    }

    this.kreise
      .selectAll('.kreis')
      .data(this.features)
      .enter().append('path')
      .attr('class', function(d) { return 'kreis kreis-' + d.id; })
      .attr('title', function(d) { return d.name; })
      .attr('d', this.path)
      .on('click', function(d){
        if (self.state.kreis === d.id) { return; }
        self.state.kreis = d.id;
        self.activateKreis(d.id);
        self.updateState();
      })
      .on('mousemove', function(d){
        if (isTouch()) { return; }
        var offset = $('#vis').offset();
        var x = (d3.event.x || d3.event.clientX) + offset.left - 60;
        if (x > self.width - 300) {
          x -= 100;
        } else if (x < 60) {
          x += 60;
        }
        var y = (d3.event.y || d3.event.clientY) + offset.top  - 60;

        $('#hoverlabel').find('.hl-name').text(d.properties.name);
        $('#hoverlabel').find('.hl-value').text(self.showPlaceholderLabel(self.state.key, d));

        $('#hoverlabel')
          .show()
          .css({left: x + 'px', top: y + 'px'});
      })
      .on('mouseout', function(){
        $('#hoverlabel').hide();
      });

    this.kreise.append('path')
      .datum(topojson.mesh(kreise, kreise.objects.kreise, function(a, b) { return a !== b; }))
      .attr('d', this.path)
      .attr('class', 'kreis-grenze');


    this.borders = this.svg.append('g')
      .attr('class', 'borders');

    this.borders.append('path')
      .datum(topojson.mesh(kreise, kreise.objects.land, function(a, b) { return a === b; }))
      .attr('d', this.path)
      .attr('class', 'staat-grenze');

    this.borders.append('path')
      .datum(topojson.mesh(kreise, kreise.objects.land, function(a, b) { return a !== b; }))
      .attr('d', this.path)
      .attr('class', 'land-grenze');

    if (this.options.dorling) {
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
          if (self.state.kreis === d.id) { return; }
          self.state.kreis = d.id;
          self.activateKreis(d.id);
          self.updateState();
        });
    }

    if (!this.options.noControls) {
      this.places = this.svg.append('g')
        .attr('class', 'places');
      this.places.selectAll('.shadow')
        .data(topojson.feature(kreise, kreise.objects.places).features)
        .enter()
          .append('text')
          .attr('class', 'place-label shadow')
          .attr('dx', -5)
          .attr("transform", function(d) { return "translate(" + self.projection(d.geometry.coordinates) + ")"; })
          .text(function(d) { return d.properties.cityname; });
      this.places.selectAll('.label')
        .data(topojson.feature(kreise, kreise.objects.places).features)
        .enter()
          .append('text')
          .attr('class', 'place-label label')
          .attr('dx', -5)
          .attr("transform", function(d) { return "translate(" + self.projection(d.geometry.coordinates) + ")"; })
          .text(function(d) { return d.properties.cityname; });
    }
    this.postInit();
  };

  Kreiskarte.prototype.updateMap = function() {
    var self = this;

    var dimension = this.options.dimensions[this.state.key];
    var kreisColor;
    kreisColor = this.kreisColor[this.state.key];

    this.kreise.selectAll('.kreis')
      .style('fill', function(d){
        var val = self.getValue(d, dimension.key, self.state.jahr)
        if (val !== null) {
          return kreisColor(val);
        } else {
          return 'none';
        }
    });

    var legendScale = d3.scale.linear()
      .domain(kreisColor.domain())
      .range(kreisColor.range());

    var legendWidth = 20;
    this.legend.attr('width', legendWidth * kreisColor.range().length);
    this.legend.selectAll('rect').remove();
    this.legend.selectAll('text').remove();
    this.legend.selectAll('rect')
      .data(kreisColor.range())
        .enter()
        .append('rect')
        .attr('x', function(d, i){
          return i * legendWidth;
        })
        .attr('fill', function(d){
          return d;
        })
        .attr({
          y: 0,
          width: legendWidth,
          height: 10
        });
      this.legend.selectAll('text')
        .data(kreisColor.domain())
          .enter()
          .append('text')
          .attr('x', function(d, i){
            return i * kreisColor.range().length * legendWidth;
          })
          .attr('text-anchor', function(d, i) {
            return i % 2 === 0 ? 'start' : 'end';
          })
          .text(function(d){
            return dimension.makeLabel ? dimension.makeLabel(d) : Math.round(d);
          })
          .attr({
            y: 25
          });

    if (this.options.dorling) {
      this.dorling.selectAll('.kreis-circle')
        .style('fill', function(d){
          return kreisColor(d.properties[dimension.key]);
        })
        .attr('r', function(d) {
          return self.kreisCircle(d.properties.count);
        });
    }

  };

  Kreiskarte.prototype.processPostcodes = function(error, data) {
    var self = this;
    this.plz = {};
    for (var i = 0; i < data.length; i += 1) {
      this.plz[data[i].plz] = data[i].ags;
    }
    d3.select('.plz-search').style('visibility', 'visible');
    this.plzInput = d3.select('.' + this.options.plzInput);
    this.plzInput.on('input', function() {
      self.plzSearch(this.value);
    });
    this.postInit();
  };

  Kreiskarte.prototype.plzSearch = function(plz) {
    var kreis = this.plz[plz];
    if (kreis === undefined ) {
      d3.select('.' + this.options.plzInput).classed('wrong', true);
      if (!this.state.kreis) { return false; }
      this.state.kreis = '';
      this.deactivateKreis();
      this.updateState();
      return false;
    }
    d3.select('.' + this.options.plzInput).classed('wrong', false);
    if (this.state.kreis === kreis) { return; }
    this.state.kreis = kreis;
    this.deactivateKreis();
    this.activateKreis(kreis);
    this.updateState();
  };

  Kreiskarte.prototype.activateKreis = function() {
    var kreis = this.state.kreis;
    if (!kreis) {
      return this.deactivateKreis();
    }
    var elem = this.svg.select('.kreis-' + kreis);
    var d = this.svg.select('.kreis-' + kreis).data()[0];
    if (d && !elem.classed('active')) {
      elem.moveToFront();
      this.activated = d;
      this.svg.selectAll('.kreis').classed('active', false);
      this.svg.selectAll('.kreis-circle').classed('active', false);
      this.svg.selectAll('.kreis-' + kreis).classed('active', true);
      this.svg.selectAll('.kreis-circle-' + kreis).classed('active', true);
      this.zoomToBounds(d);
      d3.selectAll('.kreis-info').style('display', 'block');
      d3.selectAll('.kreis-name').text(d.properties.name);
      for (var i = 0; i < this.options.placeholders.length; i++) {
        var placeholder = this.options.placeholders[i];
        d3.selectAll('.' + placeholder).text(d.properties[placeholder]);
      }
      if (d.properties.mre_rise === null) {
        d3.selectAll('.mre_rise-section').style('display', 'none');
      } else {
        d3.select('.mre_rise-section').style('display', 'inline');
        d3.selectAll('.mre_rise').text(Math.abs(d.properties.mre_rise));
        if (d.properties.mre_rise < 0) {
          d3.selectAll('.mre_rise-label').text('verringert');
          d3.selectAll('.mre_rise-icon').classed('icon-up-circled', false);
          d3.selectAll('.mre_rise-icon').classed('icon-down-circled', true);
        } else if (d.properties.mre_rise > 0) {
          d3.selectAll('.mre_rise-label').text('erhöht');
          d3.selectAll('.mre_rise-icon').classed('icon-down-circled', false);
          d3.selectAll('.mre_rise-icon').classed('icon-up-circled', true);
        } else {
          d3.selectAll('.mre_rise-icon').classed('icon-down-circled', false);
          d3.selectAll('.mre_rise-icon').classed('icon-up-circled', false);
          d3.selectAll('.mre_rise-label').text('verändert');
        }
      }
      d3.selectAll('.mrsa_p').attr('title', d.properties.mrsa + ' Fälle');
      d3.selectAll('.vre_p').attr('title', d.properties.vre + ' Fälle');
      d3.selectAll('.esbl_p').attr('title', d.properties.esbl + ' Fälle');
      d3.selectAll('.mrsa-color').style('background-color', this.kreisColor.mrsa(d.properties.mrsa_p));
      d3.selectAll('.esbl-color').style('background-color', this.kreisColor.esbl(d.properties.esbl_p));
      d3.selectAll('.vre-color').style('background-color', this.kreisColor.vre(d.properties.vre_p));
    }
  };

  Kreiskarte.prototype.deactivateKreis = function() {
    this.activated = null;
    this.svg.selectAll('.kreis').classed('active', false);
    this.svg.selectAll('.kreis-circle').classed('active', false);
    d3.selectAll('.kreis-info').style('display', 'none');
    this.zoomToBounds();
  };

  Kreiskarte.prototype.showZoom = function(kreis) {
    var d = this.svg.select('.kreis-' + kreis).data()[0];
    this.zoomToBounds(d);
  };

  Kreiskarte.prototype.zoomToBounds = function(d) {
    var x, y, k, tw, th;
    if (d) {
      var centroid = this.path.centroid(d);
      x = centroid[0];
      y = centroid[1];
      k = this.options.noControls ? 8 : 5;
      tw = this.width / 2;
      th = this.height / 2;
      this.svg.classed('zoomed', true);
      $('#zoomout').show();
    } else {
      x = this.width / 2;
      y = this.height / 2;
      k = 1;
      tw = this.width / 2;
      th = this.height / 2;
      this.svg.classed('zoomed', false);
      delete this.state.zoom;
      $('#zoomout').hide();
    }

    this.svg.transition()
        .duration(this.options.noControls ? 0 : 750)
        .attr('transform', 'translate(' + tw + ',' + th + ')scale(' + k + ')translate(' + -x + ',' + -y + ')');
  };

  window.Kreiskarte = Kreiskarte;

}(window));
