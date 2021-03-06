"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _domRenderer = require("./dom-renderer");

var _domRenderer2 = _interopRequireDefault(_domRenderer);

var _svgRenderer = require("./svg-renderer");

var _svgRenderer2 = _interopRequireDefault(_svgRenderer);

var _nullRenderer = require("./null-renderer");

var _nullRenderer2 = _interopRequireDefault(_nullRenderer);

var _boardState = require("./board-state");

var _boardState2 = _interopRequireDefault(_boardState);

var _ruleset = require("./ruleset");

var _ruleset2 = _interopRequireDefault(_ruleset);

var _scorer = require("./scorer");

var _scorer2 = _interopRequireDefault(_scorer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var VALID_GAME_OPTIONS = ["element", "boardSize", "scoring", "handicapStones", "koRule", "komi", "_hooks", "fuzzyStonePlacement", "renderer", "freeHandicapPlacement"];

var Game = function Game() {
  var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

  this._validateOptions(options);

  this._defaultBoardSize = 19;
  this.boardSize = null;
  this._moves = [];
  this.callbacks = {
    postRender: function postRender() {},
    postMove: function postMove() {} // arg: currentPlayer, isPass
  };
  this._boardElement = options["element"];
  this._defaultScoring = "territory";
  this._defaultKoRule = "simple";
  this._defaultRenderer = "svg";
  this._deadPoints = [];

  this._setup(options);
};

Game.prototype = {
  _validateOptions: function _validateOptions(options) {
    for (var key in options) {
      if (options.hasOwnProperty(key)) {
        if (VALID_GAME_OPTIONS.indexOf(key) < 0) {
          throw new Error("Unrecognized game option: " + key);
        }

        if (typeof options[key] === "undefined" || options[key] === null) {
          throw new Error("Game option " + key + " must not be set as null or undefined");
        }
      }
    }
  },

  _configureOptions: function _configureOptions() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref$boardSize = _ref.boardSize,
        boardSize = _ref$boardSize === undefined ? this._defaultBoardSize : _ref$boardSize,
        _ref$komi = _ref.komi,
        komi = _ref$komi === undefined ? 0 : _ref$komi,
        _ref$handicapStones = _ref.handicapStones,
        handicapStones = _ref$handicapStones === undefined ? 0 : _ref$handicapStones,
        _ref$freeHandicapPlac = _ref.freeHandicapPlacement,
        freeHandicapPlacement = _ref$freeHandicapPlac === undefined ? false : _ref$freeHandicapPlac,
        _ref$scoring = _ref.scoring,
        scoring = _ref$scoring === undefined ? this._defaultScoring : _ref$scoring,
        _ref$koRule = _ref.koRule,
        koRule = _ref$koRule === undefined ? this._defaultKoRule : _ref$koRule,
        _ref$renderer = _ref.renderer,
        renderer = _ref$renderer === undefined ? this._defaultRenderer : _ref$renderer;

    if (typeof boardSize !== "number") {
      throw new Error("Board size must be a number, but was: " + (typeof boardSize === "undefined" ? "undefined" : _typeof(boardSize)));
    }

    if (typeof handicapStones !== "number") {
      throw new Error("Handicap stones must be a number, but was: " + (typeof boardSize === "undefined" ? "undefined" : _typeof(boardSize)));
    }

    if (handicapStones > 0 && boardSize !== 9 && boardSize !== 13 && boardSize !== 19) {
      throw new Error("Handicap stones not supported on sizes other than 9x9, 13x13 and 19x19");
    }

    if (handicapStones < 0 || handicapStones === 1 || handicapStones > 9) {
      throw new Error("Only 2 to 9 handicap stones are supported");
    }

    if (boardSize > 19) {
      throw new Error("cannot generate a board size greater than 19");
    }

    this.boardSize = boardSize;
    this.handicapStones = handicapStones;
    this._freeHandicapPlacement = freeHandicapPlacement;

    this._scorer = new _scorer2.default({
      scoreBy: scoring,
      komi: komi
    });

    this._rendererChoice = {
      "dom": _domRenderer2.default,
      "svg": _svgRenderer2.default
    }[renderer];

    if (!this._rendererChoice) {
      throw new Error("Unknown renderer: " + renderer);
    }

    this._ruleset = new _ruleset2.default({
      koRule: koRule
    });

    if (this._freeHandicapPlacement) {
      this._initialState = _boardState2.default._initialFor(boardSize, 0);
    } else {
      this._initialState = _boardState2.default._initialFor(boardSize, handicapStones);
    }
  },

  _stillPlayingHandicapStones: function _stillPlayingHandicapStones() {
    return this._freeHandicapPlacement && this.handicapStones > 0 && this._moves.length < this.handicapStones;
  },

  _setup: function _setup() {
    var _this = this;

    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    this._validateOptions(options);
    this._configureOptions(options);

    if (this._boardElement) {
      var defaultRendererHooks = {
        handleClick: function handleClick(y, x) {
          if (_this.isOver()) {
            _this.toggleDeadAt(y, x);
          } else {
            _this.playAt(y, x);
          }
        },

        hoverValue: function hoverValue(y, x) {
          if (!_this.isOver() && !_this.isIllegalAt(y, x)) {
            return _this.currentPlayer();
          }
        },

        gameIsOver: function gameIsOver() {
          return _this.isOver();
        }
      };

      this.renderer = new this._rendererChoice(this._boardElement, {
        hooks: options["_hooks"] || defaultRendererHooks,
        options: {
          fuzzyStonePlacement: options["fuzzyStonePlacement"]
        }
      });
    } else {
      this.renderer = new _nullRenderer2.default();
    }

    this.render();
  },

  intersectionAt: function intersectionAt(y, x) {
    return this.currentState().intersectionAt(y, x);
  },

  intersections: function intersections() {
    return this.currentState().intersections;
  },

  deadStones: function deadStones() {
    return this._deadPoints;
  },

  coordinatesFor: function coordinatesFor(y, x) {
    return this.currentState().xCoordinateFor(x) + this.currentState().yCoordinateFor(y);
  },

  currentPlayer: function currentPlayer() {
    if (this._stillPlayingHandicapStones()) {
      return "black";
    }

    return this.currentState().nextColor();
  },

  isWhitePlaying: function isWhitePlaying() {
    return this.currentPlayer() === "white";
  },

  isBlackPlaying: function isBlackPlaying() {
    return this.currentPlayer() === "black";
  },

  score: function score() {
    return this._scorer.score(this);
  },

  currentState: function currentState() {
    return this._moves[this._moves.length - 1] || this._initialState;
  },

  moveNumber: function moveNumber() {
    return this.currentState().moveNumber;
  },

  labelsAt: function labelsAt(labels) {
    var nextColor = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "black";
    // array of x, y, label
    for (var i = 0; i < labels.length; ++i) {
      var newState = this.currentState().labelAt(labels[i].x, labels[i].y, labels[i].label);
      this._moves.push(newState);
    }
    this._moves.push(this.currentState().setColor(nextColor));
    this.render();
    return true;
  },

  stonesAt: function stonesAt(stones) {
    var nextColor = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "black";
    // array of x, y, color
    for (var i = 0; i < stones.length; ++i) {
      var newState = this.currentState().playAt(stones[i].x, stones[i].y, stones[i].color, true);
      this._moves.push(newState);
    }
    this._moves.push(this.currentState().setColor(nextColor));
    this.render();
    return true;
  },

  playAt: function playAt(y, x) {
    var _ref2 = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
        _ref2$render = _ref2.render,
        render = _ref2$render === undefined ? true : _ref2$render;

    var player = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;

    if (this.isIllegalAt(y, x)) {
      return false;
    }

    var currentPlayer = player ? player : this.currentPlayer();

    var newState = this.currentState().playAt(y, x, currentPlayer);
    var _newState = newState,
        koPoint = _newState.koPoint;


    if (koPoint && !this._ruleset._isKoViolation(koPoint.y, koPoint.x, newState, this._moves.concat(newState))) {
      newState = newState.copyWithAttributes({ koPoint: null });
    }

    this._moves.push(newState);
    this.callbacks.postMove(this, currentPlayer, false);

    if (render) {
      this.render();
    }

    return true;
  },

  pass: function pass() {
    var _ref3 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref3$render = _ref3.render,
        render = _ref3$render === undefined ? true : _ref3$render;

    if (this.isOver()) {
      return false;
    }

    var currentPlayer = this.currentPlayer();

    var newState = this.currentState().playPass(currentPlayer);
    this._moves.push(newState);
    this.callbacks.postMove(this, currentPlayer, true);

    if (render) {
      this.render();
    }

    return true;
  },

  isOver: function isOver() {
    if (this._moves.length < 2) {
      return false;
    }

    var finalMove = this._moves[this._moves.length - 1];
    var previousMove = this._moves[this._moves.length - 2];

    return finalMove.pass && previousMove.pass;
  },

  markDeadAt: function markDeadAt(y, x) {
    var _ref4 = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
        _ref4$render = _ref4.render,
        render = _ref4$render === undefined ? true : _ref4$render;

    if (this._isDeadAt(y, x)) {
      return true;
    }

    return this._setDeadStatus(y, x, true, { render: render });
  },

  unmarkDeadAt: function unmarkDeadAt(y, x) {
    var _ref5 = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
        _ref5$render = _ref5.render,
        render = _ref5$render === undefined ? true : _ref5$render;

    if (!this._isDeadAt(y, x)) {
      return true;
    }

    return this._setDeadStatus(y, x, false, { render: render });
  },

  toggleDeadAt: function toggleDeadAt(y, x) {
    var _ref6 = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
        _ref6$render = _ref6.render,
        render = _ref6$render === undefined ? true : _ref6$render;

    return this._setDeadStatus(y, x, !this._isDeadAt(y, x), { render: render });
  },

  _setDeadStatus: function _setDeadStatus(y, x, markingDead) {
    var _this2 = this;

    var _ref7 = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {},
        _ref7$render = _ref7.render,
        render = _ref7$render === undefined ? true : _ref7$render;

    var selectedIntersection = this.intersectionAt(y, x);

    if (selectedIntersection.isEmpty()) {
      return;
    }

    var chosenDead = [];

    var _currentState$partiti = this.currentState().partitionTraverse(selectedIntersection, function (intersection) {
      return intersection.isEmpty() || intersection.sameColorAs(selectedIntersection);
    }),
        _currentState$partiti2 = _slicedToArray(_currentState$partiti, 1),
        candidates = _currentState$partiti2[0];

    candidates.forEach(function (sameColorOrEmpty) {
      if (!sameColorOrEmpty.isEmpty()) {
        chosenDead.push(sameColorOrEmpty);
      }
    });

    chosenDead.forEach(function (intersection) {
      if (markingDead) {
        _this2._deadPoints.push({ y: intersection.y, x: intersection.x });
      } else {
        _this2._deadPoints = _this2._deadPoints.filter(function (dead) {
          return !(dead.y === intersection.y && dead.x === intersection.x);
        });
      }
    });

    if (render) {
      this.render();
    }

    return true;
  },

  _isDeadAt: function _isDeadAt(y, x) {
    return this._deadPoints.some(function (dead) {
      return dead.y === y && dead.x === x;
    });
  },

  isIllegalAt: function isIllegalAt(y, x) {
    return this._ruleset.isIllegal(y, x, this);
  },

  territory: function territory() {
    if (!this.isOver()) {
      return {
        black: [],
        white: []
      };
    }

    return this._scorer.territory(this);
  },

  undo: function undo() {
    this._moves.pop();
    this.render();
  },

  clear: function clear() {
    this._moves = [];
    this.render();
  },

  render: function render() {
    if (!this.isOver()) {
      this._deadPoints = [];
    }

    this.renderer.render(this.currentState(), {
      territory: this.territory(),
      deadStones: this.deadStones()
    });

    this.callbacks.postRender(this);
  }
};

exports.default = Game;

//# sourceMappingURL=game.js.map