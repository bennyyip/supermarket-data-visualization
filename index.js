(function (d3, dimple) {
  'use strict'
  // const[[[1
  //SVG的宽度和高度
  const W = window.innerWidth / 2.5
  const H = window.innerHeight / 2.5

  const profitColors = d3.scaleQuantize().range([
    '#D32F2F', '#E53935', '#F44336',
    '#EF5350', '#E57373', '#EF9A9A',

    '#BBDEFB', '#90CAF9', '#64B5F6',
    '#42A5F5', '#2196F3', '#1E88E5'
  ])

  profitColors.domain([-1, 1])

  const salesColors = d3.scaleQuantize().range([
    "#d9f0a3",
    "#addd8e",
    "#78c679",
    "#41ab5d",
    "#238443",
    "#005a32"
  ])

  var ELEMENTS = {
    slider: document.querySelector('#year-slider'),
    sliderLabel: document.querySelector('#year-slider-label'),
    map: document.querySelector('#map'),
    barChart: document.querySelector('#bar-chart'),
    ringChart: document.querySelector('#ring-chart'),
    legend: document.querySelector('#legend'),
    profitOrSalesRadio: document.getElementsByName('profitorsales'),
  }

  var tip = d3.tip()
    .attr('class', 'd3-tip')
    .offset([-10, 0])
    .html(function (state) {
      if (!!state.properties.profit) {
        var color = state.properties.profit >= 0 ? '#5fba7d' : 'red';
        return "<strong style='color:orange'>State:</strong> <span>" + state.properties.name + "</span>" + "</br><strong style='color:orange'>Sales:</strong> <span>" + state.properties.sales.formatMoney() + "</span>" + "</br><strong style='color:orange'>Profit:</strong> <span style='color:" + color + "'>" + state.properties.profit.formatMoney() + "</span>"

      } else {
        return 'no data'
      }
    })
  // utils [[[1
  // load data [[[2
  function loadCSV(url) {
    return new Promise((resolve, reject) => {
      d3.csv(url, (err, data) => {
        if (err) {
          console.log(err)
          reject(err)
        } else {
          resolve(data)
        }
      })
    })
  }

  function loadJSON(url) {
    return new Promise((resolve, reject) => {
      d3.json(url, (err, data) => {
        if (err) {
          console.log(err)
          reject(err)
        } else {
          resolve(data)
        }
      })
    })
  }
  // process data [[[2
  function processData(orders) {
    var result = {}
    result[2009] = {}  // all time
    orders.forEach(order => {
      var ref = order['OrderDate'].split('/').map(Number)
      var year = ref[2]

      var state = order['State']
      var cate = order['ProductSubCategory']
      var profit = parseFloat(order['Profit'])
      var sales = parseFloat(order['Sales'])

      if (!result[year]) { result[year] = {} }

      if (!result[year][state]) {
        result[year][state] = {
          profit: 0,
          sales: 0,
          name: state
        }
      }

      if (!result[2009][state]) {
        result[2009][state] = {
          profit: 0,
          sales: 0,
          name: state
        }
      }

      if (!result[year][state][cate]) {
        result[year][state][cate] = {
          profit: 0,
          sales: 0,
          Category: cate
        }
      }

      if (!result[2009][state][cate]) {
        result[2009][state][cate] = {
          profit: 0,
          sales: 0,
          Category: cate
        }
      }


      result[year][state][cate].profit += profit
      result[year][state][cate].sales += sales
      result[year][state].profit += profit
      result[year][state].sales += sales

      result[2009][state][cate].profit += profit
      result[2009][state][cate].sales += sales
      result[2009][state].profit += profit
      result[2009][state].sales += sales
    })
    return result
  }
  // misc [[[2
  Number.prototype.formatMoney = function (c, d, t) {
    var n = this,
      c = isNaN(c = Math.abs(c)) ? 2 : c,
      d = d == undefined ? '.' : d,
      t = t == undefined ? ',' : t,
      s = n < 0 ? '-' : '',
      i = String(parseInt(n = Math.abs(Number(n) || 0).toFixed(c))),
      j = (j = i.length) > 3 ? j % 3 : 0;
    return s + (j ? i.substr(0, j) + t : '') + i.substr(j).replace(/(\d{3})(?=\d)/g, '$1' + t) + (c ? d + Math.abs(n - i).toFixed(c).slice(2) : '');
  }

  function floorMoney(x) {
    if (x > 1000) {
      return (x / 1000).toFixed(0) + 'K'
    } else if (x > 100) {
      return (x / 100).toFixed(0) + '00'
    } else {
      return x.toFixed(0)
    }
  }
  // US Map [[[1
  var USMap = function USMap(usstate) {

    var projection = d3.geoPath()
      .projection(d3.geoAlbersUsa().translate([W / 2, H / 2]).scale(W))

    // select usmap
    var usMap = d3.select("#map")
      .attr("width", W)
      .attr("height", H)

    // 生成州
    var pathes = usMap
      .selectAll('path')
      .data(usstate.features)
      .enter()
      .append('path')
      .attr('d', projection)
      .attr('class', 'state')

    // 绑定 DOM 元素和数据, 便于后续使用
    pathes.each(function (data) {
      this.data = data
    })

    this.pathes = pathes

    // tooltip
    pathes
      .on('mouseover', tip.show)
      .on('mouseout', tip.hide)

    // init d3-tip
    usMap.call(tip)

  }

  // Data Viewer [[[1
  var DataViewer = function DataViewer(orders, pathes, year) {
    this.selectedState = null
    this.orders = orders
    this.pathes = pathes
    this.profitOrSales = true // true for profit, false for sales

    this.setYear(year)

    // select year
    ELEMENTS.profitOrSalesRadio.forEach(d => d.onclick = (e => {
      this.profitOrSales = (e.target.value == 'profit')
      this.updateColor()
    }))

    // select state
    ELEMENTS.map.addEventListener('click', this.selectState.bind(this))
    this.selectedState = null
  }

  DataViewer.prototype.selectState = function selectState(e) {
    var target = e.target
    if (target.classList.contains('state')) {
      this.setState(target.data.properties.name)
    } else {
      this.setState(null)
    }
  }

  DataViewer.prototype.setState = function setState(state) {
    if (this.selectedState !== state) {
      this.selectedState = state
      this.updateCharts()
    }
  }


  DataViewer.prototype.setYear = function setYear(year) {
    if (!!this.orders[year]) {
      this.year = year

      // 计算最大/最小利润/销售额
      var orders = Object.values(this.orders[year])

      this.maxProfit = d3.max(orders, state => state.profit)
      this.minProfit = d3.min(orders, state => state.profit)

      var maxSales = d3.max(orders, state => state.sales)
      var minSales = d3.min(orders, state => state.sales)
      salesColors.domain([minSales, maxSales]).nice()

      var x = d3.scaleBand().rangeRound([0, W]).padding(0.1)
      var y = d3.scaleLinear().rangeRound([H, 0])

      x.domain(orders.map(state => state.name));
      y.domain([this.minProfit, this.maxProfit]);

      this.updateColor()
      this.updateCharts()
    }
  }

  DataViewer.prototype.updateColor = function updateColor() {
    var ordersThisYear = this.orders[this.year]

    this.updateLegend()

    this.pathes
      .transition()
      .duration(500)
      .ease(d3.easeLinear).style('fill', state => {
        var s = ordersThisYear[state.properties.name]
        if (!!s) {
          state.properties.profit = s.profit
          state.properties.sales = s.sales
          if (this.profitOrSales) { return profitColors(s.profit > 0 ? s.profit / this.maxProfit : -s.profit / this.minProfit) }
          else { return salesColors(s.sales) }
        }
        return '#eee'
      })
  }


  DataViewer.prototype.updateLegend = function updateLegend() {
    ELEMENTS.legend.innerHTML = ''
    var legend = d3.select('#legend')
      .append('ul')
      .attr('class', 'list-inline')
      .style('width', W * 0.8 + 'px')

    if (this.profitOrSales) {

      var keys = legend.selectAll('li.key')
        .data(profitColors.range())

      keys.enter().append('li')
        .attr('class', 'key')
        .style('border-top-color', String)
        .style('width', 100.0 / 12 + '%')
        .text(d => {
          var r = profitColors.invertExtent(d)
          var p = r[0] * (r[0] < 0 ? this.minProfit : this.maxProfit)
          return floorMoney(p)
        })

    } else {
      var keys = legend.selectAll('li.key')
        .data(salesColors.range())

      keys.enter().append('li')
        .attr('class', 'key')
        .style('border-top-color', String)
        .style('width', 100.0 / 6 + '%')
        .text(function (d) {
          var r = salesColors.invertExtent(d)
          return floorMoney(r[0])
        })
    }
  }

  DataViewer.prototype.updateCharts = function updateCharts() {
    if (!!this.selectedState) {
      this.updateBarChart()
      this.updateRingChart()
    }
  }

  DataViewer.prototype.updateRingChart = function updateRingChart() {
    ELEMENTS.ringChart.innerHTML = ''
    var orders = Object.values(this.orders[this.year][this.selectedState])

    console.log(orders)

    var svg = d3.select('#ring-chart').attr('width', W).attr('height', H)
    var ringChart = new dimple.chart(svg, orders);
    ringChart.addMeasureAxis("p", "sales");
    ringChart.addLegend(W - 100, 20, 90, 300, "left");
    var ring = ringChart.addSeries("Category", dimple.plot.pie);
    ring.innerRadius = "50%";
    ringChart.draw();
    var xOffset = W / -5
    d3.select("#ring-chart>.dimple-chart").attr("transform", "translate(" + xOffset + ",0)")
  }

  DataViewer.prototype.updateBarChart = function updateBarChart() {
    ELEMENTS.barChart.innerHTML = ''
    var orders = Object.values(this.orders[this.year][this.selectedState])
    var svg = d3.select('#bar-chart').attr('width', W).attr('height', H)
    var barChart = new dimple.chart(svg, orders);
    var x = barChart.addCategoryAxis("x", "Category");
    barChart.addMeasureAxis("y", "profit");
    barChart.addSeries(null, dimple.plot.bar);
    barChart.ease = "bounce"
    barChart.draw(1000);
  }

  // main [[[1
  Promise.all([
    loadJSON('data/us-states.json'),
    loadCSV('data/superstore-subset.csv')
  ]).then(function (ref) {
    var usstate = ref[0]
    var rawOrders = ref[1]

    var orders = processData(rawOrders)
    var usMap = new USMap(usstate)
    var dataViewer = new DataViewer(orders, usMap.pathes, 2009)

    // update map when slider is changed
    ELEMENTS.slider.onchange = ((e) => {
      var year = e.target.value
      ELEMENTS.sliderLabel.innerText = year == 2009 ? 'All' : year
      dataViewer.setYear(year)
    })
  })

}(d3, dimple))
// vim modeline [[[1
// vim:fdm=marker:fmr=[[[,]]]
