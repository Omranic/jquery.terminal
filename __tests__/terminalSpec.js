/**@license
 *       __ _____                     ________                              __
 *      / // _  /__ __ _____ ___ __ _/__  ___/__ ___ ______ __ __  __ ___  / /
 *  __ / // // // // // _  // _// // / / // _  // _//     // //  \/ // _ \/ /
 * /  / // // // // // ___// / / // / / // ___// / / / / // // /\  // // / /__
 * \___//____ \\___//____//_/ _\_  / /_//____//_/ /_/ /_//_//_/ /_/ \__\_\___/
 *           \/              /____/                              version {{VER}}
 *
 * This file is part of jQuery Terminal. http://terminal.jcubic.pl
 * Copyright (c) 2010-2018 Jakub Jankiewicz <http://jcubic.pl/me>
 * Released under the MIT license
 */
/* global global, it, expect, describe, require, spyOn, setTimeout, location,
          beforeEach, afterEach, sprintf, jQuery, $, wcwidth */
/* TODO: test caseSensitivity */

function Storage() {}
Storage.prototype.getItem = function(name) {
    return this[name];
};
Storage.prototype.setItem = function(name, value) {
    return this[name] = value;
};
Storage.prototype.removeItem = function(name) {
    var value = this[name];
    delete this[name];
    return value;
};
Storage.prototype.clear = function() {
    var self = this;
    Object.getOwnPropertyNames(this).forEach(function(name) {
        delete self[name];
    });
};
// https://github.com/tmpvar/jsdom/issues/135
Object.defineProperties(window.HTMLElement.prototype, {
    offsetLeft: {
        get: function() { return parseFloat(window.getComputedStyle(this).marginLeft) || 0; }
    },
    offsetTop: {
        get: function() { return parseFloat(window.getComputedStyle(this).marginTop) || 0; }
    },
    offsetHeight: {
        get: function() { return parseFloat(window.getComputedStyle(this).height) || 0; }
    },
    offsetWidth: {
        get: function() { return parseFloat(window.getComputedStyle(this).width) || 0; }
    },
    // this will test if setting 1ch change value to 1ch which don't work in jsdom used by jest
    style: {
        get: function() {
            if (this.__style) {
                return this.__style;
            }
            var self = this;
            var attr = {};
            function set_style_attr() {
                self.setAttribute('style', Object.keys(attr).map((key) => `${key}: ${attr[key]};`));
            }
            var mapping = {
                backgroundClip: 'background-clip',
                className: 'class'
            };
            var reversed_mapping = {};
            Object.keys(mapping).forEach(key => {
                reversed_mapping[mapping[key]] = key;
            });
            return this.__style = new Proxy({}, {
                set: function(target, name, value) {
                    name = mapping[name] || name;
                    if (!value) {
                        delete target[name];
                        delete attr[name];
                    } else {
                        attr[name] = target[name] = value;
                    }
                    set_style_attr();
                    return true;
                },
                deleteProperty: function(target, name) {
                    name = reversed_mapping[name] || name;
                    delete target[name];
                    delete attr[name];
                    set_style_attr();
                }
            });
        }
    }
});

global.window.Element.prototype.getBoundingClientRect = function() {
    var self = $(this);
    return {width: self.width(), height: self.height()};
};
global.window.Element.prototype.getClientRects = function() {
    var self = $(this);
    var node = this;
    while(node) {
        if(node === document) {
            break;
        }
        // don't know why but style is sometimes undefined
        if (!node.style || node.style.display === 'none' ||
            node.style.visibility === 'hidden') {
            return [];
        }
        node = node.parentNode;
    }
    return [{width: self.width(), height: self.height()}];
};
window.localStorage = new Storage();
global.alert = window.alert = function(string) {
    console.log(string);
};
global.location = global.window.location = {hash: ''};
global.document = window.document;
global.jQuery = global.$ = require("jquery");
global.wcwidth = require('wcwidth');
require('../js/jquery.terminal-src')(global.$);
require('../js/unix_formatting')(global.$);

function nbsp(string) {
    return string.replace(/ /g, '\xA0');
}
function spy(obj, method) {
    var spy = spyOn(obj, method);
    if (spy.andCallThrough) {
        spy.andCallThrough();
    } else {
        spy.and.callThrough();
    }
    return spy;
}
function count(spy) {
    if (spy.calls.count) {
        return spy.calls.count();
    } else if (spy.calls.callCount) {
        return spy.calls.callCount;
    } else {
        return spy.calls.length;
    }
}
function reset(spy) {
    if (spy.calls.reset) {
        spy.calls.reset();
    } else if (spy.calls.callCount) {
        spy.calls.callCount = 0;
    } else {
        spy.calls.length = 0;
    }
}
function enter_text(text) {
    var e;
    var $root = $(document.documentElement || window);
    for (var i=0; i<text.length; ++i) {
        e = $.Event("keydown");
        e.which = e.keyCode = text.toUpperCase().charCodeAt(i);
        e.key = text[i];
        $root.trigger(e);
        e = $.Event("keypress");
        e.which = e.keyCode = text.charCodeAt(i);
        e.key = text[i];
        e.ctrlKey = false;
        e.altKey = false;
        $root.trigger(e);
    }
}
function keydown(ctrl, alt, shift, which, key) {
    var e = $.Event("keydown");
    e.ctrlKey = ctrl;
    e.altKey = alt;
    e.shiftKey = shift;
    if (typeof which === 'string') {
        key = which;
        which = key.toUpperCase().charCodeAt(0);
    }
    e.key = key;
    e.which = e.keyCode = which;
    return e;
}
function keypress(key) {
    var e = $.Event("keypress");
    e.key = key;
    e.which = e.keyCode = 0;
    return e;
}
function shortcut(ctrl, alt, shift, which, key) {
    var doc = $(document.documentElement || window);
    if (typeof which === 'string') {
        key = which;
        which = key.toUpperCase().charCodeAt(0);
    }
    doc.trigger(keydown(ctrl, alt, shift, which, key));
    doc.trigger(keypress(key));
    doc.trigger($.Event("keyup"));
}
function enter_key() {
    shortcut(false, false, false, 13, 'enter');
}
function enter(term, text) {
    term.insert(text).focus();
    enter_key();
}

function last_div(term) {
    return term.find('.terminal-output > div:eq(' + term.last_index() + ')');
}
function output(term) {
    return term.find('.terminal-output > div div').map(function() {
        return $(this).text().replace(/\xA0/g, ' ');
    }).get();
}
function timer(callback, timeout) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            try {
                resolve(callback());
            } catch(e) {
                reject(e);
            }
        }, timeout);
    });
}


var support_animations = (function() {
    var animation = false,
    animationstring = 'animation',
    keyframeprefix = '',
    domPrefixes = 'Webkit Moz O ms Khtml'.split(' '),
    pfx  = '',
    elm = document.createElement('div');
    if (elm.style.animationName) {
        animation = true;
    }
    if (animation === false) {
        for (var i = 0; i < domPrefixes.length; i++) {
            var name = domPrefixes[i] + 'AnimationName';
            if (typeof elm.style[name] !== 'undefined') {
                pfx = domPrefixes[i];
                animationstring = pfx + 'Animation';
                keyframeprefix = '-' + pfx.toLowerCase() + '-';
                animation = true;
                break;
            }
        }
    }
    return animation;
})();


describe('Terminal utils', function() {
    var command = 'test "foo bar" baz /^asd [x]/ str\\ str 10 1e10 "" foo"bar" \'foo\'';
    var args = '"foo bar" baz /^asd [x]/ str\\ str 10 1e10 "" foo"bar" \'foo\'';
    describe('$.terminal.split_arguments', function() {
        it('should create array of arguments', function() {
            expect($.terminal.split_arguments(args)).toEqual([
                'foo bar',
                'baz',
                '/^asd [x]/',
                'str str',
                '10',
                '1e10',
                '',
                'foo"bar"',
                "foo"
            ]);
        });
    });
    describe('$.terminal.parse_arguments', function() {
        it('should create array of arguments and convert types', function() {
            expect($.terminal.parse_arguments(args)).toEqual([
                'foo bar',
                'baz',
                    /^asd [x]/,
                'str str',
                10,
                1e10,
                '',
                'foobar',
                'foo'
            ]);
        });
    });
    describe('$.terminal.split_command', function() {
        it('Should split command', function() {
            var cmd = jQuery.terminal.split_command(command);
            expect(cmd).toEqual({
                command: command,
                name: 'test',
                args: [
                    'foo bar',
                    'baz',
                    '/^asd [x]/',
                    'str str',
                    '10',
                    '1e10',
                    '',
                    'foo"bar"',
                    'foo'
                ],
                args_quotes: ['"', '', '', '', '', '', '"', '', "'"],
                rest: '"foo bar" baz /^asd [x]/ str\\ str 10 1e10 "" foo"bar" \'foo\''
            });
        });
    });
    describe('$.terminal.parse_command', function() {
        it('should split and parse command', function() {
            var cmd = jQuery.terminal.parse_command(command);
            expect(cmd).toEqual({
                command: command,
                name: 'test',
                args: [
                    'foo bar',
                    'baz',
                        /^asd [x]/,
                    'str str',
                    10,
                    1e10,
                    '',
                    'foobar',
                    'foo'
                ],
                args_quotes: ['"', '', '', '', '', '', '"', '', "'"],
                rest: '"foo bar" baz /^asd [x]/ str\\ str 10 1e10 "" foo"bar" \'foo\''
            });
        });
        it('should handle JSON string', function() {
            var cmd = jQuery.terminal.parse_command('{"demo": ["error"]}');
            expect(cmd).toEqual({
                command: '{"demo": ["error"]}',
                name: '{"demo":',
                args: ['[error]}'],
                args_quotes: [""],
                rest: '["error"]}'
            });
        });
    });
    describe('$.terminal.from_ansi', function() {
        var ansi_string = '\x1b[2;31;46mFoo\x1b[1;3;4;32;45mB[[sb;;]a]r\x1b[0m\x1b[7mBaz';
        it('should convert ansi to terminal formatting', function() {
            var string = $.terminal.from_ansi(ansi_string);
            expect(string).toEqual('[[;#640000;#008787]Foo][[biu;#44D544;#F5F]'+
                                   'B[[sb;;]a]r][[;#000;#AAA]Baz]');
        });
        it('should convert ansi to terminal formatting and escape the remaining brackets', function() {
            var string = $.terminal.from_ansi(ansi_string, {
                unixFormattingEscapeBrackets: true
            });
            expect(string).toEqual('[[;#640000;#008787]Foo][[biu;#44D544;#F5F]'+
                                   'B&#91;&#91;sb;;&#93;a&#93;r][[;#000;#AAA]Baz]');
        });
    });
    describe('$.terminal.overtyping', function() {
        it('should convert to terminal formatting', function() {
            var string = 'HELLO TERMINAL'.replace(/./g, function(chr) {
                return chr == ' ' ? chr : chr + '\x08' + chr;
            });
            var result = '[[b;#fff;]HELLO] [[b;#fff;]TERMINAL]';
            expect($.terminal.overtyping(string)).toEqual(result);
        });
        it('should create underline', function() {
            var string = 'HELLO TERMINAL'.replace(/./g, function(chr) {
                return chr == ' ' ? chr : chr + '\x08_';
            });
            var result = '[[u;;]HELLO TERMINAL]';
        });
        it('should process normal backspaces', function() {
            var tests = [
                ['Checking current state.\t[    ]\b\b\b\b\bFAIL\r\n',
                 "Checking current state.\t[FAIL]\r\n"
                ],
                ['[Start]\b\b] \b\b\b\b\b\b    \b\b\b\b---\b\b\b   \b\b\bDone] show be displa'+
                 'yed as [Done]',
                 '[Done] show be displayed as [Done]'
                ],
                ['Test 2.\t[    ]\b\b\b\b\bFAIL\nTest 3.\t[    ]\b\b\b\b\bWARNING]\n',
                 'Test 2.\t[FAIL]\nTest 3.\t[WARNING]\n'
                ]
            ];
            tests.forEach(function(spec) {
                expect($.terminal.overtyping(spec[0])).toEqual(spec[1]);
            });
        });
    });
    describe('$.terminal.escape_brackets', function() {
        var string = '[[jQuery]] [[Terminal]]';
        var result = '&#91;&#91;jQuery&#93;&#93; &#91;&#91;Terminal&#93;&#93;';
        it('should replace [ and ] with html entities', function() {
            expect($.terminal.escape_brackets(string)).toEqual(result);
        });
    });
    describe('$.terminal.nested_formatting', function() {
        var specs = [
            [
                '[[;red;]foo[[;blue;]bar]baz]',
                '[[;red;]foo][[;blue;]bar][[;red;]baz]'
            ],
            [
                '[[;#fff;] lorem [[b;;]ipsum [[s;;]dolor] sit] amet]',
                '[[;#fff;] lorem ][[b;;]ipsum ][[s;;]dolor][[b;;] sit][[;#fff;] amet]'
            ]
        ];
        it('should create list of formatting', function() {
            specs.forEach(function(spec) {
                expect($.terminal.nested_formatting(spec[0])).toEqual(spec[1]);
            });
        });
    });
    describe('$.terminal.encode', function() {
        var tags = '<hello> </hello>\t<world> </world>';
        var tags_result = '&lt;hello&gt;&nbsp;&lt;/hello&gt;&nbsp;&nbsp;&nbsp;'+
                '&nbsp;&lt;world&gt;&nbsp;&lt;/world&gt;';
        it('should convert < > space and tabs', function() {
            expect($.terminal.encode(tags)).toEqual(tags_result);
        });
        var entites = '& & &amp; &64; &#61; &#91';
        //'&amp;&nbsp;&amp;&nbsp;&amp;&nbsp;&amp;64;&nbsp;&#61;&nbsp;&#91'
        var ent_result = '&amp;&nbsp;&amp;&nbsp;&amp;&nbsp;&amp;64;&nbsp;&#61;'+
                '&nbsp;&amp;#91';
        it('it should convert & but not when used with entities', function() {
            expect($.terminal.encode(entites)).toEqual(ent_result);
        });
    });
    describe('$.terminal.format_split', function() {
        var input = [
            ['[[;;]][[;;]Foo][[;;]Bar][[;;]]', ['[[;;]]','[[;;]Foo]','[[;;]Bar]','[[;;]]']],
            ['Lorem[[;;]]Ipsum[[;;]Foo]Dolor[[;;]Bar]Sit[[;;]]Amet', [
                'Lorem', '[[;;]]', 'Ipsum', '[[;;]Foo]', 'Dolor', '[[;;]Bar]', 'Sit', '[[;;]]', 'Amet'
            ]]
        ];
        it('should split text inot formatting', function() {
            input.forEach(function(spec) {
                expect($.terminal.format_split(spec[0])).toEqual(spec[1]);
            });
        });
    });
    describe('$.terminal.substring', function() {
        var input = '[[;;]Lorem ipsum dolor sit amet], [[;;]consectetur adipiscing elit]. [[;;]Maecenas ac massa tellus. Sed ac feugiat leo].';
        it('should return substring when starting at 0', function() {
            var tests = [
                [25, '[[;;]Lorem ipsum dolor sit ame]'],
                [26, '[[;;]Lorem ipsum dolor sit amet]'],
                [27, '[[;;]Lorem ipsum dolor sit amet],'],
                [30, '[[;;]Lorem ipsum dolor sit amet], [[;;]co]']
            ];
            tests.forEach(function(spec) {
                expect($.terminal.substring(input, 0, spec[0])).toEqual(spec[1]);
            });
        });
        it('should create formatting for each character', function() {
            var formatting = '[[b;;;token number]10][[b;;;token operator]+][[b;;;token number]10]';

            var len = $.terminal.strip(formatting).length;
            var result = [];
            for (var i = 0; i < len; ++i) {
                result.push($.terminal.substring(formatting, i,i+1));
            }
            expect(result).toEqual([
                '[[b;;;token number]1]',
                '[[b;;;token number]0]',
                '[[b;;;token operator]+]',
                '[[b;;;token number]1]',
                '[[b;;;token number]0]'
            ]);
        });
        it('should return substring when ending at length or larger', function() {
            var tests = [
                [0, '[[;;]Lorem ipsum dolor sit amet], [[;;]consectetur adipiscing elit]. [[;;]Maecenas ac massa tellus. Sed ac feugiat leo].'],
                [10, '[[;;]m dolor sit amet], [[;;]consectetur adipiscing elit]. [[;;]Maecenas ac massa tellus. Sed ac feugiat leo].'],
                [27, ' [[;;]consectetur adipiscing elit]. [[;;]Maecenas ac massa tellus. Sed ac feugiat leo].'],
                [30, '[[;;]nsectetur adipiscing elit]. [[;;]Maecenas ac massa tellus. Sed ac feugiat leo].']
            ];
            tests.forEach(function(spec) {
                expect($.terminal.substring(input, spec[0], 102)).toEqual(spec[1]);
                expect($.terminal.substring(input, spec[0], 200)).toEqual(spec[1]);
            });
        });
        it('should return substring when input starts from normal text', function() {
            var input = 'Lorem Ipsum [[;;]Dolor]';
            expect($.terminal.substring(input, 10, 200)).toEqual('m [[;;]Dolor]');
        });
        it('should substring when string have no formatting', function() {
            var input = 'Lorem Ipsum Dolor Sit Amet';
            var tests = [
                [0, 10, 'Lorem Ipsu'],
                [10, 20, 'm Dolor Si'],
                [20, 27, 't Amet']
            ];
            tests.forEach(function(spec) {
                expect($.terminal.substring(input, spec[0], spec[1])).toEqual(spec[2]);
            });
        });
    });
    describe('$.terminal.normalize', function() {
        function test(specs) {
            specs.forEach(function(spec) {
                expect($.terminal.normalize(spec[0])).toEqual(spec[1]);
            });
        }
        it('should add 5 argument to formatting', function() {
            var tests = [
                ['[[;;]Lorem] [[;;]Ipsum] [[;;;]Dolor]', '[[;;;;Lorem]Lorem] [[;;;;Ipsum]Ipsum] [[;;;;Dolor]Dolor]'],
                ['[[;;;;]Lorem Ipsum Dolor] [[;;;;]Amet]', '[[;;;;Lorem Ipsum Dolor]Lorem Ipsum Dolor] [[;;;;Amet]Amet]']
            ];
            test(tests);
        });
        it('should not add 5 argument', function() {
            var tests = [
                [
                    '[[;;;;Foo]Lorem Ipsum Dolor] [[;;;;Bar]Amet]',
                    '[[;;;;Foo]Lorem Ipsum Dolor] [[;;;;Bar]Amet]']
            ];
            test(tests);
        });
        it('should remove empty formatting', function() {
            var tests = [
                [
                    '[[;;]]Lorem Ipsum [[;;]]Dolor Sit [[;;;;]]Amet',
                    'Lorem Ipsum Dolor Sit Amet'
                ]
            ];
            test(tests);
        });
    });
    describe('$.terminal.is_formatting', function() {
        it('should detect terminal formatting', function() {
            var formattings = [
                '[[;;]Te[xt]',
                '[[;;]Te\\]xt]',
                '[[;;]]',
                '[[gui;;;class]Text]',
                '[[b;#fff;]Text]',
                '[[b;red;blue]Text]'];
            var not_formattings = [
                '[[;;]Text[',
                '[[Text]]',
                '[[Text[[',
                '[[;]Text]',
                'Text]',
                '[[Text',
                '[;;]Text]'];
            formattings.forEach(function(formatting) {
                expect($.terminal.is_formatting(formatting)).toEqual(true);
            });
            not_formattings.forEach(function(formatting) {
                expect($.terminal.is_formatting(formatting)).toEqual(false);
            });
        });
    });
    describe('$.terminal.escape_regex', function() {
        it('should escape regex special characters', function() {
            var safe = "\\\\\\^\\*\\+\\?\\.\\$\\[\\]\\{\\}\\(\\)";
            expect($.terminal.escape_regex('\\^*+?.$[]{}()')).toEqual(safe);
        });
    });
    describe('$.terminal.have_formatting', function() {
        var formattings = [
            'some text [[;;]Te[xt] and formatting',
            'some text [[;;]Te\\]xt] and formatting',
            'some text [[;;]] and formatting',
            'some text [[gui;;;class]Text] and formatting',
            'some text [[b;#fff;]Text] and formatting',
            'some text [[b;red;blue]Text] and formatting'];
        var not_formattings = [
            'some text [[;;]Text[ and formatting',
            'some text [[Text]] and formatting',
            'some text [[Text[[ and formatting',
            'some text [[;]Text] and formatting',
            'some text Text] and formatting',
            'some text [[Text and formatting',
            'some text [;;]Text] and formatting'];
        it('should detect terminal formatting', function() {
            formattings.forEach(function(formatting) {
                expect($.terminal.have_formatting(formatting)).toEqual(true);
            });
            not_formattings.forEach(function(formatting) {
                expect($.terminal.have_formatting(formatting)).toEqual(false);
            });
        });
    });
    describe('$.terminal.valid_color', function() {
        it('should mark hex color as valid', function() {
            var valid_colors = ['#fff', '#fab', '#ffaacc', 'red', 'blue'];
            valid_colors.forEach(function(color) {
                expect($.terminal.valid_color(color)).toBe(true);
            });
        });
    });
    describe('$.terminal.format', function() {
        var format = '[[biugs;#fff;#000]Foo][[i;;;foo]Bar][[ous;;]Baz]';
        it('should create html span tags with style and classes', function() {
            var string = $.terminal.format(format);
            expect(string).toEqual('<span style="font-weight:bold;text-decorat'+
                                   'ion:underline line-through;font-style:ital'+
                                   'ic;color:#fff;text-shadow:0 0 5px #fff;bac'+
                                   'kground-color:#000" data-text="Foo">Foo</s'+
                                   'pan><span style="font-style:italic;" class'+
                                   '="foo" data-text="Bar">Bar</span><span sty'+
                                   'le="text-decoration:underline line-through'+
                                   ' overline;" data-text="Baz">Baz</span>');
        });
        it('should handle wider characters without formatting', function() {
            var input = 'ターミナルウィンドウは黒[[;;]です]';
            var string = $.terminal.format(input, {char_width: 7});
            expect(string).toEqual('<span style="width: 24ch"><span style="widt'+
                                   'h: 24ch">ターミナルウィンドウは黒</span></span'+
                                   '><span style="width: 4ch" data-text="です">'+
                                   '<span style="width: 4ch">です</span></span>');
        });
        it('should handle links', function() {
            var input = '[[!;;]https://terminal.jcubic.pl]';
            var tests = [
                [
                    '<a target="_blank" href="https://terminal.jcubic.pl"'+
                        ' rel="noopener" tabindex="1000">https://terminal.jcubic.pl<'+
                        '/a>',
                    {}
                ],
                [
                    '<a target="_blank" href="https://terminal.jcubic.pl"'+
                        ' rel="noreferrer noopener" tabindex="1000">https'+
                        '://terminal.jcubic.pl</a>',
                    {
                        linksNoReferrer: true
                    }
                ]
            ];
            tests.forEach(function(spec) {
                var expected = spec[0];
                var options = spec[1];
                var output = $.terminal.format(input, spec[1]);
                expect(output).toEqual(expected);
            });
        });
        it('should handle javascript links', function() {
            var js = "javascript".split('').map(function(chr) {
                return '&#' + chr.charCodeAt(0) + ';';
            }).join('');
            var tests = [
                [
                    "[[!;;;;javascript:alert('x')]xss]", {},
                    '<a target="_blank" href=""' +
                        ' rel="noopener" tabindex="1000">xss<'+
                        '/a>'
                ],
                [
                    "[[!;;;;javascript:alert('x')]xss]", {anyLinks: true},
                    '<a target="_blank" href="javascript:alert(\'x\')"' +
                        ' rel="noopener" tabindex="1000">xss<'+
                        '/a>'
                ],
                [
                    "[[!;;;;" + js + ":alert('x')]xss]", {},
                    '<a target="_blank" href=""' +
                        ' rel="noopener" tabindex="1000">xss<'+
                        '/a>'
                ],
                [
                    "[[!;;;;JaVaScRiPt:alert('x')]xss]", {anyLinks: false},
                    '<a target="_blank" href=""' +
                        ' rel="noopener" tabindex="1000">xss<'+
                        '/a>'
                ],
            ];
            tests.forEach(function(spec) {
                var output = $.terminal.format(spec[0], spec[1]);
                expect(output).toEqual(spec[2]);
            });
        });
        it('should add nofollow', function() {
            var input = '[[!;;]https://terminal.jcubic.pl]';
            var tests = [
                [
                    '<a target="_blank" href="https://terminal.jcubic.pl"'+
                        ' rel="nofollow noopener" tabindex="1000">https://terminal.jcubic.pl<'+
                        '/a>',
                    {linksNoFollow: true}
                ],
                [
                    '<a target="_blank" href="https://terminal.jcubic.pl"'+
                        ' rel="nofollow noreferrer noopener" tabindex="1000">https'+
                        '://terminal.jcubic.pl</a>',
                    {
                        linksNoReferrer: true,
                        linksNoFollow: true
                    }
                ]
            ];
            tests.forEach(function(spec) {
                var expected = spec[0];
                var options = spec[1];
                var output = $.terminal.format(input, spec[1]);
                expect(output).toEqual(expected);
            });
        });
        it('should handle emails', function() {
            var tests = [
                [
                    '[[!;;]jcubic@onet.pl]',
                    '<a href="mailto:jcubic@onet.pl" tabindex="1000">jcubic@onet.pl</a>'
                ],
                [
                    '[[!;;;;jcubic@onet.pl]j][[!;;;;jcubic@onet.pl]cubic@onet.pl]',
                    '<a href="mailto:jcubic@onet.pl" tabindex="1000">j</a>' +
                        '<a href="mailto:jcubic@onet.pl" tabindex="1000">c' +
                        'ubic@onet.pl</a>'
                ]
            ];
            tests.forEach(function([input, expected]) {
                expect($.terminal.format(input)).toEqual(expected);
            });
        });
        it('should skip empty parts', function() {
            var input = '[[;;]]x[[b;;]y][[b;;]z]';
            var output = $.terminal.format(input);
            expect(output).toEqual('<span>x</span><span style="font-weight:' +
                                   'bold;" data-text="y">y</span><span styl' +
                                   'e="font-weight:bold;" data-text="z">z</span>');
        });
    });
    describe('$.terminal.strip', function() {
        it('should remove formatting', function() {
            var formatting = '-_-[[biugs;#fff;#000]Foo]-_-[[i;;;foo]Bar]-_-[[ous;;'+
                    ']Baz]-_-';
            var result = '-_-Foo-_-Bar-_-Baz-_-';
            expect($.terminal.strip(formatting)).toEqual(result);
        });
        it('should remove escaping brackets from string', function() {
            var formatting = 'foo [[;;]bar\\]baz]';
            var result = 'foo bar]baz';
            expect($.terminal.strip(formatting)).toEqual(result);
        });
    });
    describe('$.terminal.apply_formatters', function() {
        var formatters;
        beforeEach(function() {
            formatters = $.terminal.defaults.formatters;
        });
        afterEach(function() {
            $.terminal.defaults.formatters = formatters;
        });
        it('should apply function formatters', function() {
            $.terminal.defaults.formatters = [
                function(str) {
                    return str.replace(/a/g, '[[;;;A]a]');
                },
                function(str) {
                    return str.replace(/b/g, '[[;;;B]b]');
                }
            ];
            var input = 'aaa bbb';
            var output = '[[;;;A]a][[;;;A]a][[;;;A]a] [[;;;B]b][[;;;B]b][[;;;B]b]';
            expect($.terminal.apply_formatters(input)).toEqual(output);
        });
        it('should apply __meta__ and array formatter', function() {
            var input = 'lorem ipsum';
            var output = '[[;;]lorem] ipsum';
            var test = {
                formatter: function(string) {
                    expect(string).toEqual(output);
                    return string.replace(/ipsum/g, '[[;;]ipsum]');
                }
            };
            spy(test, 'formatter');
            test.formatter.__meta__ = true;
            $.terminal.defaults.formatters = [[/lorem/, '[[;;]lorem]'], test.formatter];
            expect($.terminal.apply_formatters(input)).toEqual('[[;;]lorem] [[;;]ipsum]');
            expect(test.formatter).toHaveBeenCalled();
        });
        it('should throw except', function() {
            var formatters = $.terminal.defaults.formatters.slice();
            $.terminal.defaults.formatters.push(function() {
                x();
            });
            expect(function() {
                $.terminal.apply_formatters('foo');
            }).toThrow($.terminal.Exception('Error in formatter [' +
                                            (formatters.length - 1) +
                                            ']'));
            $.terminal.defaults.formatters.pop();
        });
    });
    describe('$.terminal.split_equal', function() {
        var text = ['[[bui;#fff;]Lorem ipsum dolor sit amet, consectetur adipi',
                    'scing elit. Nulla sed dolor nisl, in suscipit justo. Donec a enim',
                    ' et est porttitor semper at vitae augue. Proin at nulla at dui ma',
                    'ttis mattis. Nam a volutpat ante. Aliquam consequat dui eu sem co',
                    'nvallis ullamcorper. Nulla suscipit, massa vitae suscipit ornare,',
                    ' tellus] est [[b;;#f00]consequat nunc, quis blandit elit odio eu ',
                    'arcu. Nam a urna nec nisl varius sodales. Mauris iaculis tincidun',
                    't orci id commodo. Aliquam] non magna quis [[i;;]tortor malesuada',
                    ' aliquam] eget ut lacus. Nam ut vestibulum est. Praesent volutpat',
                    ' tellus in eros dapibus elementum. Nam laoreet risus non nulla mo',
                    'llis ac luctus [[ub;#fff;]felis dapibus. Pellentesque mattis elem',
                    'entum augue non sollicitudin. Nullam lobortis fermentum elit ac m',
                    'ollis. Nam ac varius risus. Cras faucibus euismod nulla, ac aucto',
                    'r diam rutrum sit amet. Nulla vel odio erat], ac mattis enim.'
                   ].join('');
        it('should keep formatting if it span across multiple lines', function() {
            var array = ["[[bui;#fff;;;Lorem ipsum dolor sit amet, consectetur adipisc"+
                         "ing elit. Nulla sed dolor nisl, in suscipit justo. Donec a e"+
                         "nim et est porttitor semper at vitae augue. Proin at nulla a"+
                         "t dui mattis mattis. Nam a volutpat ante. Aliquam consequat "+
                         "dui eu sem convallis ullamcorper. Nulla suscipit, massa vita"+
                         "e suscipit ornare, tellus]Lorem ipsum dolor sit amet, consec"+
                         "tetur adipiscing elit. Nulla sed dolor nisl, in suscipit jus"+
                         "to. Do]","[[bui;#fff;;;Lorem ipsum dolor sit amet, consectet"+
                         "ur adipiscing elit. Nulla sed dolor nisl, in suscipit justo."+
                         " Donec a enim et est porttitor semper at vitae augue. Proin "+
                         "at nulla at dui mattis mattis. Nam a volutpat ante. Aliquam "+
                         "consequat dui eu sem convallis ullamcorper. Nulla suscipit, "+
                         "massa vitae suscipit ornare, tellus]nec a enim et est portti"+
                         "tor semper at vitae augue. Proin at nulla at dui mattis matt"+
                         "is. Nam a volutp]","[[bui;#fff;;;Lorem ipsum dolor sit amet,"+
                         " consectetur adipiscing elit. Nulla sed dolor nisl, in susci"+
                         "pit justo. Donec a enim et est porttitor semper at vitae aug"+
                         "ue. Proin at nulla at dui mattis mattis. Nam a volutpat ante"+
                         ". Aliquam consequat dui eu sem convallis ullamcorper. Nulla "+
                         "suscipit, massa vitae suscipit ornare, tellus]at ante. Aliqu"+
                         "am consequat dui eu sem convallis ullamcorper. Nulla suscipi"+
                         "t, massa vitae suscipit or]","[[bui;#fff;;;Lorem ipsum dolor"+
                         " sit amet, consectetur adipiscing elit. Nulla sed dolor nisl"+
                         ", in suscipit justo. Donec a enim et est porttitor semper at"+
                         " vitae augue. Proin at nulla at dui mattis mattis. Nam a vol"+
                         "utpat ante. Aliquam consequat dui eu sem convallis ullamcorp"+
                         "er. Nulla suscipit, massa vitae suscipit ornare, tellus]nare"+
                         ", tellus] est [[b;;#f00;;consequat nunc, quis blandit elit o"+
                         "dio eu arcu. Nam a urna nec nisl varius sodales. Mauris iacu"+
                         "lis tincidunt orci id commodo. Aliquam]consequat nunc, quis "+
                         "blandit elit odio eu arcu. Nam a urna nec nisl varius sodale"+
                         "s.]","[[b;;#f00;;consequat nunc, quis blandit elit odio eu a"+
                         "rcu. Nam a urna nec nisl varius sodales. Mauris iaculis tinc"+
                         "idunt orci id commodo. Aliquam] Mauris iaculis tincidunt orc"+
                         "i id commodo. Aliquam] non magna quis [[i;;;;tortor malesuad"+
                         "a aliquam]tortor malesuada aliquam] eget ut l","acus. Nam ut"+
                         " vestibulum est. Praesent volutpat tellus in eros dapibus el"+
                         "ementum. Nam laoreet risus n","on nulla mollis ac luctus [[u"+
                         "b;#fff;;;felis dapibus. Pellentesque mattis elementum augue "+
                         "non sollicitudin. Nullam lobortis fermentum elit ac mollis. "+
                         "Nam ac varius risus. Cras faucibus euismod nulla, ac auctor "+
                         "diam rutrum sit amet. Nulla vel odio erat]felis dapibus. Pel"+
                         "lentesque mattis elementum augue non sollicitudin. Nulla]",
                         "[[ub;#fff;;;felis dapibus. Pellentesque mattis elementum aug"+
                         "ue non sollicitudin. Nullam lobortis fermentum elit ac molli"+
                         "s. Nam ac varius risus. Cras faucibus euismod nulla, ac auct"+
                         "or diam rutrum sit amet. Nulla vel odio erat]m lobortis ferm"+
                         "entum elit ac mollis. Nam ac varius risus. Cras faucibus eui"+
                         "smod nulla, ac auctor dia]","[[ub;#fff;;;felis dapibus. Pell"+
                         "entesque mattis elementum augue non sollicitudin. Nullam lob"+
                         "ortis fermentum elit ac mollis. Nam ac varius risus. Cras fa"+
                         "ucibus euismod nulla, ac auctor diam rutrum sit amet. Nulla "+
                         "vel odio erat]m rutrum sit amet. Nulla vel odio erat], ac ma"+
                         "ttis enim."];
            $.terminal.split_equal(text, 100).forEach(function(line, i) {
                expect(line).toEqual(array[i]);
            });
        });
        it("should keep formatting if span across line with newline characters", function() {
            var text = ['[[bui;#fff;]Lorem ipsum dolor sit amet, consectetur adipi',
                        'scing elit. Nulla sed dolor nisl, in suscipit justo. Donec a enim',
                        ' et est porttitor semper at vitae augue. Proin at nulla at dui ma',
                        'ttis mattis. Nam a volutpat ante. Aliquam consequat dui eu sem co',
                        'nvallis ullamcorper. Nulla suscipit, massa vitae suscipit ornare,',
                        ' tellus]'].join('\n');
            var formatting = /^\[\[bui;#fff;;;Lorem ipsum dolor sit amet, consectetur adipi\\nscing elit. Nulla sed dolor nisl, in suscipit justo. Donec a enim\\n et est porttitor semper at vitae augue. Proin at nulla at dui ma\\nttis mattis. Nam a volutpat ante. Aliquam consequat dui eu sem co\\nnvallis ullamcorper. Nulla suscipit, massa vitae suscipit ornare,\\n tellus\]/;
            $.terminal.split_equal(text, 100).forEach(function(line, i) {
                if (!line.match(formatting)) {
                    throw new Error("Line nr " + i + " " + line + " don't have correct " +
                                    "formatting");
                }
            });
        });
        function test_lenghts(string, fn) {
            var cols = [10, 40, 50, 60, 400];
            for (var i=cols.length; i--;) {
                var lines = $.terminal.split_equal(string, cols[i]);
                var max_len;
                var lengths;
                if (fn) {
                    lengths = lines.map(function(line) {
                        return fn(line).length;
                    });
                    max_len = fn(string).length;
                } else {
                    lengths = lines.map(function(line) {
                        return line.length;
                    });
                    max_len = fn.length;
                }
                lengths.forEach(function(length, j) {
                    var max = max_len < cols[i] ? max_len : cols[i];
                    if (j < lengths - 1) {
                        if (length != max) {
                            throw new Error('Lines count is ' + JSON.stringify(lengths) +
                                            ' but it should have ' + cols[i] +
                                            ' line ' + JSON.stringify(lines[j]));
                        }
                    } else {
                        if (length > max) {
                            throw new Error('Lines count is ' + JSON.stringify(lengths) +
                                            ' but it should have ' + cols[i] +
                                            ' line ' + JSON.stringify(lines[j]));
                        }
                    }
                });
                expect(true).toEqual(true);
            }
        }
        it('should split text into equal length chunks', function() {
            test_lenghts(text, function(line) {
                return $.terminal.strip(line);
            });
        });
        it('should split text when all brackets are escaped', function() {
            test_lenghts($.terminal.escape_brackets(text), function(line) {
                return $('<div>' + line + '</div>').text();
            });
        });
        it('should return whole lines if length > then the length of the line', function() {
            var test = [
                {
                    input: ['[[bui;#fff;]Lorem ipsum dolor sit amet,] consectetur adipi',
                            'scing elit.'].join(''),
                    output: [['[[bui;#fff;;;Lorem ipsum dolor sit amet,]Lorem ipsum dol',
                              'or sit amet,] consectetur adipiscing elit.'].join('')]
                },
                {
                    input: ['[[bui;#fff;]Lorem ipsum dolor sit amet, consectetur adipi',
                            'scing elit.]'].join(''),
                    output: [[
                        '[[bui;#fff;;;Lorem ipsum dolor sit amet, consectetur adipi',
                        'scing elit.]Lorem ipsum dolor sit amet, consectetur adipis',
                        'cing elit.]'].join('')]
                },
                {
                    input: ['[[bui;#fff;]Lorem ipsum dolor sit amet, consectetur adipi',
                            'scing elit.]\n[[bui;#fff;]Lorem ipsum dolor sit amet, con',
                            'sectetur adipiscing elit.]'].join(''),
                    output: [
                        [
                            '[[bui;#fff;;;Lorem ipsum dolor sit amet, consectetur adipi',
                            'scing elit.]Lorem ipsum dolor sit amet, consectetur adipis',
                            'cing elit.]'].join(''),
                        ['[[bui;#fff;;;Lorem ipsum dolor sit amet, consectetur adipi',
                         'scing elit.]Lorem ipsum dolor sit amet, consectetur adipis',
                         'cing elit.]'].join('')]
                },
                {
                    input: ['[[bui;#fff;]Lorem ipsum dolor sit amet, consectetur adipi',
                            'scing elit.]\n[[bui;#fff;]Lorem ipsum dolor sit amet, con',
                            'sectetur adipiscing elit.]\n[[bui;#fff;]Lorem ipsum dolor',
                            ' sit amet, consectetur adipiscing elit.]\n[[bui;#fff;]Lor',
                            'em ipsum dolor sit amet, consectetur adipiscing elit.]'
                           ].join(''),
                    output: ['[[bui;#fff;;;Lorem ipsum dolor sit amet, consectetur adi'+
                             'piscing elit.]Lorem ipsum dolor si]','[[bui;#fff;;;Lorem'+
                             ' ipsum dolor sit amet, consectetur adipiscing elit.]t am'+
                             'et, consectetur ]','[[bui;#fff;;;Lorem ipsum dolor sit a'+
                             'met, consectetur adipiscing elit.]adipiscing elit.]','[['+
                             'bui;#fff;;;Lorem ipsum dolor sit amet, consectetur adipi'+
                             'scing elit.]Lorem ipsum dolor si]','[[bui;#fff;;;Lorem i'+
                             'psum dolor sit amet, consectetur adipiscing elit.]t amet'+
                             ', consectetur ]','[[bui;#fff;;;Lorem ipsum dolor sit ame'+
                             't, consectetur adipiscing elit.]adipiscing elit.]','[[bu'+
                             'i;#fff;;;Lorem ipsum dolor sit amet, consectetur adipisc'+
                             'ing elit.]Lorem ipsum dolor si]','[[bui;#fff;;;Lorem ips'+
                             'um dolor sit amet, consectetur adipiscing elit.]t amet, '+
                             'consectetur ]','[[bui;#fff;;;Lorem ipsum dolor sit amet,'+
                             ' consectetur adipiscing elit.]adipiscing elit.]','[[bui;'+
                             '#fff;;;Lorem ipsum dolor sit amet, consectetur adipiscin'+
                             'g elit.]Lorem ipsum dolor si]','[[bui;#fff;;;Lorem ipsum'+
                             ' dolor sit amet, consectetur adipiscing elit.]t amet, co'+
                             'nsectetur ]','[[bui;#fff;;;Lorem ipsum dolor sit amet, c'+
                             'onsectetur adipiscing elit.]adipiscing elit.]'],
                    split: 20
                }
            ];
            test.forEach(function(test) {
                var array = $.terminal.split_equal(test.input, test.split || 100);
                expect(array).toEqual(test.output);
            });
        });
        it('should handle new line as first character of formatting #375', function() {
            var specs = [
                ['A[[;;]\n]B', ['A', '[[;;;;\\n]]B']],
                ['A[[;;]\nB]C', ['A', '[[;;;;\\nB]B]C']]
            ];
            specs.forEach(function(spec) {
                expect($.terminal.split_equal(spec[0])).toEqual(spec[1]);
            });
        });
        it('should handle wider characters', function() {
            var input = 'ターミナルウィンドウは黒です';
            var count = 0;
            var len = 0;
            $.terminal.split_equal(input, 4).forEach(function(string) {
                var width = wcwidth(string);
                expect(width).toEqual(4);
                expect(string.length).toEqual(2);
                len += string.length;
                count += width;
            });
            expect(wcwidth(input)).toEqual(count);
            expect(input.length).toEqual(len);
        });
        it('should handle mixed size characters', function() {
            var input = 'ターミナルウィンドウは黒です lorem ipsum';
            var given = $.terminal.split_equal(input, 10);
            given.forEach(function(string) {
                expect(string.length).toBeLessThan(11);
                expect(wcwidth(string)).toBeLessThan(11);
            });
            var expected = ["ターミナル", "ウィンドウ", "は黒です l", "orem ipsum"];
            expect(given).toEqual(expected);
        });
        it('should split normal text with brackets', function() {
            var text = 'jcubic@gitwebterm:/git [gh-pages] xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
            test_lenghts(text, function(line) {
                return $('<div>' + line + '</div>').text();
            });
            var output = $.terminal.split_equal(text, 50);
            output.forEach(function(string) {
                expect(string.length - 1).toBeLessThan(50);
            });
        });
    });
    describe('Cycle', function() {
        describe('create', function() {
            it('should create Cycle from init values', function() {
                var cycle = new $.terminal.Cycle(1, 2, 3);
                expect(cycle.get()).toEqual([1, 2, 3]);
            });
            it('should create empty Cycle', function() {
                var cycle = new $.terminal.Cycle();
                expect(cycle.get()).toEqual([]);
            });
            it('should start at the begining when called init data', function() {
                var cycle = new $.terminal.Cycle(1, 2, 3);
                expect(cycle.index()).toEqual(0);
                expect(cycle.front()).toEqual(1);
            });
            it('should start at the begining when called without data', function() {
                var cycle = new $.terminal.Cycle();
                expect(cycle.index()).toEqual(0);
                expect(cycle.front()).toEqual(undefined);
            });
        });
        describe('index', function() {
            var a = {a: 1};
            var b = {a: 2};
            var c = {a: 3};
            var d = {a: 4};
            var cycle;
            beforeEach(function() {
                cycle = new $.terminal.Cycle(a, b, c, d);
            });
            it('should return index', function() {
                expect(cycle.index()).toEqual(0);
                cycle.rotate();
                expect(cycle.index()).toEqual(1);
            });
            it('should skip index if element removed', function() {
                cycle.remove(1);
                expect(cycle.index()).toEqual(0);
                cycle.rotate();
                expect(cycle.index()).toEqual(2);
            });
        });
        describe('rotate', function() {
            var a = {a: 1};
            var b = {a: 2};
            var c = {a: 3};
            var d = {a: 4};
            var cycle;
            beforeEach(function() {
                cycle = new $.terminal.Cycle(a, b, c, d);
            });
            it('should rotate to next element', function() {
                var object = cycle.rotate();
                expect(object).toEqual({a:2});
                expect(cycle.index()).toEqual(1);
                expect(cycle.front()).toEqual({a:2});
            });
            it('should rotate to next if item removed', function() {
                cycle.remove(1);
                var object = cycle.rotate();
                expect(object).toEqual({a:3});
                expect(cycle.index()).toEqual(2);
                expect(cycle.front()).toEqual({a:3});
            });
            it('should rotate to first if last is selected', function() {
                for (var i = 0; i < 3; ++i) {
                    cycle.rotate();
                }
                var object = cycle.rotate();
                expect(object).toEqual({a:1});
                expect(cycle.index()).toEqual(0);
                expect(cycle.front()).toEqual({a:1});
            });
        });
        describe('set', function() {
            var a = {a: 1};
            var b = {a: 2};
            var c = {a: 3};
            var d = {a: 4};
            var cycle;
            beforeEach(function() {
                cycle = new $.terminal.Cycle(a, b, c, d);
            });
            it('should set existing element', function() {
                cycle.set(c);
                expect(cycle.front()).toEqual(c);
            });
            it('should add new item if not exists', function() {
                var e = {a: 5};
                cycle.set(e);
                expect(cycle.length()).toEqual(5);
                expect(cycle.index()).toEqual(4);
                expect(cycle.front()).toEqual(e);
            });
        });
        describe('map', function() {
            var a = {a: 1};
            var b = {a: 2};
            var c = {a: 3};
            var d = {a: 4};
            var cycle;
            beforeEach(function() {
                cycle = new $.terminal.Cycle(a, b, c, d);
            });
            it('should map over cycle', function() {
                var array = cycle.map(function(object) {
                    return object.a;
                });
                expect(array).toEqual([1,2,3,4]);
            });
            it('should skip removed elements', function() {
                cycle.remove(1);
                cycle.remove(3);
                var array = cycle.map(function(object) {
                    return object.a;
                });
                expect(array).toEqual([1,3]);
            });
        });
        describe('forEach', function() {
            var test = {
                test: function() {
                }
            };
            var a = {a: 1};
            var b = {a: 2};
            var c = {a: 3};
            var d = {a: 4};
            var cycle;
            beforeEach(function() {
                cycle = new $.terminal.Cycle(a, b, c, d);
                spy(test, 'test');
            });
            it('should execute callback for each item', function() {
                cycle.forEach(test.test);
                expect(count(test.test)).toBe(4);
            });
            it('should skip removed elements', function() {
                cycle.remove(1);
                cycle.forEach(test.test);
                expect(count(test.test)).toBe(3);
            });
        });
        describe('append', function() {
            it('should add element to cycle', function() {
                var cycle = new $.terminal.Cycle(1,2,3,4);
                cycle.append(5);
                expect(cycle.get()).toEqual([1,2,3,4,5]);
            });
            it('should add element to empty cycle', function() {
                var cycle = new $.terminal.Cycle();
                cycle.append(5);
                expect(cycle.get()).toEqual([5]);
            });
            it('should add element if cycle at the end', function() {
                var cycle = new $.terminal.Cycle(1,2,3);
                cycle.set(3);
                cycle.append(4);
                expect(cycle.get()).toEqual([1,2,3,4]);
            });
        });
    });
    describe('History', function() {
        function history_commands(name) {
            try {
                return JSON.parse(window.localStorage.getItem(name + '_commands'));
            } catch(e) {
                // to see in jest logs
                expect(window.localStorage.getItem(name)).toEqual('');
            }
        }
        function make_history(name, commands) {
            commands = commands || [];
            var history = new $.terminal.History('foo');
            commands.forEach(function(command) {
                history.append(command);
            });
            return history;
        }
        beforeEach(function() {
            window.localStorage.clear();
        });
        it('should create commands key', function() {
            var history = make_history('foo', ['item']);
            expect(Object.keys(window.localStorage)).toEqual(['foo_commands']);
        });
        it('should put items to localStorage', function() {
            var commands = ['lorem', 'ipsum'];
            var history = make_history('foo', commands);
            expect(history_commands('foo')).toEqual(commands);
        });
        it('should add only one commands if adding the same command', function() {
            var history = new $.terminal.History('foo');
            for (var i = 0; i < 10; ++i) {
                history.append('command');
            }
            expect(history_commands('foo')).toEqual(['command']);
        });
        it('shound not add more commands then the limit', function() {
            var history = new $.terminal.History('foo', 30);
            for (var i = 0; i < 40; ++i) {
                history.append('command ' + i);
            }
            expect(history_commands('foo').length).toEqual(30);
        });
        it('should create commands in memory', function() {
            var history = new $.terminal.History('foo', 10, true);
            for (var i = 0; i < 40; ++i) {
                history.append('command ' + i);
            }
            var data = history.data();
            expect(data instanceof Array).toBeTruthy();
            expect(data.length).toEqual(10);
            expect(window.localStorage.getItem('foo_commands')).not.toBeDefined();
        });
        it('should clear localStorage', function() {
            var history = new $.terminal.History('foo');
            for (var i = 0; i < 40; ++i) {
                history.append('command ' + i);
            }
            history.purge();
            expect(window.localStorage.getItem('foo_commands')).not.toBeDefined();
        });
        it('should iterate over commands', function() {
            var commands = ['lorem', 'ipsum', 'dolor', 'sit', 'amet'];
            var history = make_history('foo', commands);
            var i;
            for (i=commands.length; i--;) {
                expect(history.current()).toEqual(commands[i]);
                expect(history.previous()).toEqual(commands[i-1]);
            }
            for (i=0; i<commands.length; ++i) {
                expect(history.current()).toEqual(commands[i]);
                expect(history.next()).toEqual(commands[i+1]);
            }
        });
        it('should not add commands when disabled', function() {
            var commands = ['lorem', 'ipsum', 'dolor', 'sit', 'amet'];
            var history = make_history('foo', commands);
            history.disable();
            history.append('foo');
            history.enable();
            history.append('bar');
            expect(history_commands('foo')).toEqual(commands.concat(['bar']));
        });
        it('should return last item', function() {
            var commands = ['lorem', 'ipsum', 'dolor', 'sit', 'amet'];
            var history = make_history('foo', commands);
            expect(history.last()).toEqual('amet');
        });
        it('should return position', function() {
            var commands = ['lorem', 'ipsum', 'dolor', 'sit', 'amet'];
            var last_index = commands.length - 1;
            var history = make_history('foo', commands);
            expect(history.position()).toEqual(last_index);
            history.previous();
            expect(history.position()).toEqual(last_index - 1);
            history.previous();
            expect(history.position()).toEqual(last_index - 2);
            history.next();
            history.next();
            expect(history.position()).toEqual(last_index);
        });
        it('should set data', function() {
            var commands = ['lorem', 'ipsum', 'dolor', 'sit', 'amet'];
            var last_index = commands.length - 1;
            var history = make_history('foo', []);
            history.set(commands);
            expect(history_commands('foo')).toEqual(commands);
        });
    });
    describe('Stack', function() {
        describe('create', function() {
            it('should create stack from array', function() {
                var stack = new $.terminal.Stack([1, 2, 3]);
                expect(stack.data()).toEqual([1, 2, 3]);
            });
            it('should create empty stack', function() {
                var stack = new $.terminal.Stack();
                expect(stack.data()).toEqual([]);
            });
            it('should create stack from single element', function() {
                var stack = new $.terminal.Stack(100);
                expect(stack.data()).toEqual([100]);
            });
        });
        describe('map', function() {
            it('should map over data', function() {
                var stack = new $.terminal.Stack([1,2,3,4]);
                var result = stack.map(function(n) { return n + 1; });
                expect(result).toEqual([2,3,4,5]);
            });
            it('should return empty array if no data on Stack', function() {
                var stack = new $.terminal.Stack([]);
                var result = stack.map(function(n) { return n + 1; });
                expect(result).toEqual([]);
            });
        });
        describe('size', function() {
            it('should return size', function() {
                var stack = new $.terminal.Stack([1,2,3,4]);
                expect(stack.size()).toEqual(4);
            });
            it('should return 0 for empyt stack', function() {
                var stack = new $.terminal.Stack([]);
                expect(stack.size()).toEqual(0);
            });
        });
        describe('pop', function() {
            it('should remove one element from stack', function() {
                var stack = new $.terminal.Stack([1,2,3,4]);
                var value = stack.pop();
                expect(value).toEqual(4);
                expect(stack.data()).toEqual([1,2,3]);
            });
            it('should return null for last element', function() {
                var stack = new $.terminal.Stack([1,2,3,4]);
                for (var i = 0; i < 4; ++i) {
                    stack.pop();
                }
                expect(stack.pop()).toEqual(null);
                expect(stack.data()).toEqual([]);
            });
        });
        describe('push', function() {
            it('should push into empty stack', function() {
                var stack = new $.terminal.Stack();
                stack.push(100);
                expect(stack.data()).toEqual([100]);
            });
            it('should push on top of stack', function() {
                var stack = new $.terminal.Stack([1,2,3]);
                stack.push(4);
                stack.push(5);
                expect(stack.data()).toEqual([1,2,3,4,5]);
            });
        });
        describe('top', function() {
            it('should return value for first element', function() {
                var stack = new $.terminal.Stack([1,2,3]);
                expect(stack.top()).toEqual(3);
                stack.push(10);
                expect(stack.top()).toEqual(10);
                stack.pop();
                expect(stack.top()).toEqual(3);
            });
        });
        describe('clone', function() {
            it('should clone stack', function() {
                var stack = new $.terminal.Stack([1,2,3]);
                var stack_clone = stack.clone();
                expect(stack).not.toBe(stack_clone);
                expect(stack.data()).toEqual(stack_clone.data());
            });
            it('should clone empty stack', function() {
                var stack = new $.terminal.Stack([]);
                var stack_clone = stack.clone();
                expect(stack).not.toBe(stack_clone);
                expect(stack_clone.data()).toEqual([]);
            });
        });
    });
    describe('$.terminal.columns', function() {
        var input = [
            'lorem', 'ipsum', 'dolor', 'sit', 'amet',
            'lorem', 'ipsum', 'dolor', 'sit', 'amet',
            'lorem', 'ipsum', 'dolor', 'sit', 'amet'
        ];
        var output = $.terminal.columns(input, 60);
        expect(typeof output).toBe('string');
        var lines = output.split('\n');
        lines.forEach(function(line, i) {
            expect(line.split(/\s+/)).toEqual([
                'lorem', 'ipsum', 'dolor', 'sit', 'amet'
            ]);
        });
        expect($.terminal.columns(input, 5)).toEqual(input.join('\n'));
    });
    describe('$.terminal.formatter', function() {
        var t = $.terminal.formatter;
        it('should split formatting', function() {
            expect('[[;;]foo]bar[[;;]baz]'.split(t))
                .toEqual([
                    '[[;;]foo]',
                    'bar',
                    '[[;;]baz]'
                ]);
        });
        it('should strip formatting', function() {
            expect('[[;;]foo]bar[[;;]baz]'.replace(t, '$6')).toEqual('foobarbaz');
        });
        it('should match formatting', function() {
            expect('[[;;]foo]'.match(t)).toBeTruthy();
            expect('[[ ]]]'.match(t)).toBeFalsy();
        });
        it('should find formatting index', function() {
            expect('[[;;]foo]'.search(t)).toEqual(0);
            expect('xxx[[;;]foo]'.search(t)).toEqual(3);
            expect('[[ [[;;]foo] [[;;]bar]'.search(t)).toEqual(3);
        });
    });
    describe('$.terminal.parse_options', function() {
        function test(spec) {
            expect($.terminal.parse_options(spec[0], spec[2])).toEqual(spec[1]);
        }
        it('should create object from string', function() {
            test(['--foo bar -aif foo', {
                _: [],
                foo: 'bar',
                a: true,
                i: true,
                f: 'foo'
            }]);
        });
        it('should create object from array', function() {
            test([['--foo', 'bar', '-aif', 'foo'], {
                _: [],
                foo: 'bar',
                a: true,
                i: true,
                f: 'foo'
            }]);
        });
        it('should create boolean option for double dash if arg is missing', function() {
            [
                [
                    ['--foo', '-aif', 'foo'], {
                        _: [],
                        foo: true,
                        a: true,
                        i: true,
                        f: 'foo'
                    }
                ],
                [
                    ['--foo', '--bar', '-i'], {
                        _: [],
                        foo: true,
                        bar: true,
                        i: true
                    }
                ],
                [
                    ['--foo', '--bar', '-i', '-b'], {
                        _: [],
                        foo: true,
                        bar: true,
                        i: true,
                        b: true
                    }
                ]
            ].forEach(test);
        });
        it('should create booelan options if they are on the list of booleans', function() {
            test([
                ['--foo', 'bar', '-i', 'baz'], {
                    _: ["bar"],
                    foo: true,
                    i: 'baz'
                }, {
                    boolean: ['foo']
                }
            ]);
            test([
                ['--foo', 'bar', '-i', 'baz'], {
                    _: ["bar", "baz"],
                    foo: true,
                    i: true
                }, {
                    boolean: ['foo', 'i']
                }
            ]);
        });
    });
    describe('$.terminal.tracking_replace', function() {
        function test(spec) {
            spec = spec.slice();
            var result = spec.pop();
            expect($.terminal.tracking_replace.apply(null, spec)).toEqual(result);
        }
        function test_positions(str, re, replacement, positions) {
            var output = str.replace(re, replacement);
            positions.forEach(function(n, i) {
                test([str, re, replacement, i, [output, n]]);
            });
        }
        it('should replace single value', function() {
            test(['foo bar', /foo/, 'f', 0, ['f bar', 0]]);
            test(['foo foo', /foo/, 'f', 0, ['f foo', 0]]);
            test(['foo bar', /bar/, 'f', 0, ['foo f', 0]]);
        });
        it('should remove all values', function() {
            test(['foo foo foo', /foo/g, 'f', 0, ['f f f', 0]]);
        });
        it('should replace matched values', function() {
            test(['100 200 30', /([0-9]+)/g, '($1$$)', 0, ['(100$) (200$) (30$)', 0]]);
            test(['100 200 30', /([0-9]+)/, '($1$$)', 0, ['(100$) 200 30', 0]]);
        });
        it('should track position if replacement is shorter', function() {
            var positions = [0, 1, 1, 1, 2, 3, 4, 5];
            test_positions('foo bar baz', /foo/g, 'f', [0, 1, 1, 1, 2, 3, 4, 5]);
            test_positions('foo foo foo', /foo/g, 'f', [
                0, 1, 1, 1, 2, 3, 3, 3, 4, 5, 5, 5
            ]);
        });
        it('should track position if replacement is longer', function() {
            test_positions('foo bar baz', /f/g, 'bar', [
                0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13
            ]);
            test_positions('foo foo foo', /f/g, 'bar', [
                0, 3, 4, 5, 6, 9, 10, 11, 12, 15, 16, 17
            ]);
        });
    });
});
describe('sub plugins', function() {
    describe('text_length', function() {
        it('should return length of the text in div', function() {
            var elements = $('<div><span>hello</span><span>world</span>');
            expect(elements.find('span').text_length()).toEqual(10);
        });
    });
    describe('resizer', function() {
        describe('ResizeObserver', function() {
            var div, test,  node, callback;
            beforeEach(function() {
                div = $('<div/>');
                test = {
                    a: function() {},
                    b: function() {}
                };
                spy(test, 'a');
                spy(test, 'b');
                callback = null;
                window.ResizeObserver = function(observer) {
                    return {
                        unobserve: function() {
                            callback = null;
                        },
                        observe: function(node) {
                            callback = observer;
                        }
                    };
                };
                spy(window, 'ResizeObserver');
            });
            it('should create ResizeObserver', function() {
                div.resizer(function() {});
                expect(div.find('iframe').length).toBe(0);
                expect(window.ResizeObserver).toHaveBeenCalled();
                expect(typeof callback).toBe('function');
            });
            it('should call callback', function() {
                div.resizer(test.a);
                div.resizer(test.b);
                // original ResizeObserver is called on init and plugin skip it
                callback();
                callback();
                expect(test.a).toHaveBeenCalled();
                expect(test.b).toHaveBeenCalled();
            });
            it('should remove resizer', function() {
                div.resizer(test.a);
                div.resizer('unbind');
                expect(callback).toBe(null);
            });
        });
        describe('iframe', function() {
            var div, test;
            beforeEach(function() {
                div = $('<div/>').appendTo('body');
                test = {
                    a: function() {},
                    b: function() {}
                };
                spy(test, 'a');
                spy(test, 'b');
                delete window.ResizeObserver;
            });
            it('should create iframe', function() {
                div.resizer($.noop);
                expect(div.find('iframe').length).toBe(1);
            });
            it('should trigger callback', function(done) {
                div.resizer(test.a);
                $(div.find('iframe')[0].contentWindow).trigger('resize');
                setTimeout(function() {
                    expect(test.a).toHaveBeenCalled();
                    done();
                }, 100);
            });
        });
    });
    // stuff not tested in other places
    describe('cmd', function() {
        describe('display_position', function() {
            var formatters = $.terminal.defaults.formatters, cmd;
            var text = 'hello foo';
            var rep = 'foo bar';
            var replacement = 'hello ' + rep;
            var len = rep.length;
            function get_pos() {
                return [cmd.position(), cmd.display_position()];
            }
            beforeEach(function() {
                $.terminal.defaults.formatters = formatters.slice();
                $.terminal.defaults.formatters.push([/foo/g, '[[;red;]foo bar]']);
                cmd = $('<div/>').cmd();
            });
            afterEach(function() {
                $.terminal.defaults.formatters = formatters;
            });
            it('should return corrected position', function() {
                cmd.insert(text);
                expect(cmd.position()).toEqual(text.length);
                expect(cmd.display_position()).toEqual(replacement.length);
            });
            it('should not change position', function() {
                cmd.insert(text);
                var pos = get_pos();
                for (var i = 2; i < len; i++) {
                    cmd.display_position(-i, true);
                    expect([i, get_pos()]).toEqual([i, pos]);
                }
            });
            it('should change position', function() {
                cmd.insert(text);
                var pos = get_pos();
                expect(get_pos()).toEqual([9, 13]);
                cmd.display_position(-len, true);
                expect(get_pos()).toEqual([6, 6]);
                cmd.display_position(5);
                expect(get_pos()).toEqual([5, 5]);
                cmd.display_position(100);
                expect(get_pos()).toEqual(pos);
            });
        });
    });
});
describe('Terminal plugin', function() {
    describe('jQuery Terminal options', function() {
        describe('prompt', function() {
            it('should set prompt', function() {
                var prompt = '>>> ';
                var term = $('<div/>').terminal($.noop, {
                    prompt: prompt
                });
                expect(term.get_prompt()).toEqual(prompt);
            });
            it('should have default prompt', function() {
                var term = $('<div/>').terminal($.noop);
                expect(term.get_prompt()).toEqual('> ');
            });
        });
        describe('history', function() {
            it('should save data in history', function() {
                var term = $('<div/>').terminal($.noop, {
                    history: true,
                    name: 'history_enabled'
                });
                expect(term.history().data()).toEqual([]);
                var commands = ['foo', 'bar', 'baz'];
                commands.forEach(function(command) {
                    enter(term, command);
                });
                expect(term.history().data()).toEqual(commands);
            });
            it('should not store history', function() {
                var term = $('<div/>').terminal($.noop, {
                    history: false,
                    name: 'history_disabled'
                });
                expect(term.history().data()).toEqual([]);
                var commands = ['foo', 'bar', 'baz'];
                commands.forEach(function(command) {
                    enter(term, command);
                });
                expect(term.history().data()).toEqual([]);
            });
        });
        describe('exit', function() {
            it('should add exit command', function() {
                var term = $('<div/>').terminal($.noop, {
                    exit: true
                });
                term.push($.noop);
                expect(term.level()).toEqual(2);
                enter(term, 'exit');
                expect(term.level()).toEqual(1);
            });
            it('should not add exit command', function() {
                var term = $('<div/>').terminal($.noop, {
                    exit: false
                });
                term.push($.noop);
                expect(term.level()).toEqual(2);
                enter(term, 'exit');
                expect(term.level()).toEqual(2);
            });
        });
        describe('clear', function() {
            it('should add clear command', function() {
                var term = $('<div/>').terminal($.noop, {
                    clear: true
                });
                term.clear().echo('foo').echo('bar');
                expect(term.get_output()).toEqual('foo\nbar');
                enter(term, 'clear');
                expect(term.get_output()).toEqual('');
            });
            it('should not add clear command', function() {
                var term = $('<div/>').terminal($.noop, {
                    clear: false
                });
                term.clear().echo('foo').echo('bar');
                expect(term.get_output()).toEqual('foo\nbar');
                enter(term, 'clear');
                expect(term.get_output()).toEqual('foo\nbar\n> clear');
            });
        });
        describe('enabled', function() {
            it('should enable terminal', function() {
                var term = $('<div/>').terminal($.noop, {
                    enabled: true
                });
                expect(term.enabled()).toBeTruthy();
            });
            it('should not enable terminal', function() {
                var term = $('<div/>').terminal($.noop, {
                    enabled: false
                });
                expect(term.enabled()).toBeFalsy();
            });
        });
        describe('historySize', function() {
            var length = 10;
            var commands = [];
            for (var i = 0; i < 20; ++i) {
                commands.push('command ' + (i+1));
            }
            it('should limit number of history', function() {
                var term = $('<div/>').terminal($.noop, {
                    historySize: length,
                    greetings: false
                });
                commands.forEach(function(command) {
                    enter(term, command);
                });
                var history = term.history().data();
                expect(history.length).toEqual(length);
                expect(history).toEqual(commands.slice(length));
            });
        });
        describe('maskChar', function() {
            function text(term) {
                // without [data-text] is select before cursor span and spans inside
                return term.find('.cmd .cursor-line span[data-text]:not(.cursor)').text();
            }
            it('should use specified character for mask', function() {
                var mask = '-';
                var term = $('<div/>').terminal($.noop, {
                    maskChar: mask,
                    greetings: false
                });
                term.set_mask(true);
                var command = 'foo bar';
                term.insert(command);
                expect(text(term)).toEqual(command.replace(/./g, mask));
            });
        });
        describe('wrap', function() {
            var term = $('<div/>').terminal($.noop, {
                wrap: false,
                greetings: false,
                numChars: 100
            });
            it('should not wrap text', function() {
                var line = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras ultrices rhoncus hendrerit. Nunc ligula eros, tincidunt posuere tristique quis, iaculis non elit.';
                term.echo(line);
                var output = last_div(term);
                expect(output.find('span').length).toEqual(1);
                expect(output.find('div').length).toEqual(1);
            });
            it('should not wrap formatting', function() {
                var term = $('<div/>').terminal($.noop, {
                    wrap: false,
                    greetings: false,
                    numChars: 100
                });
                var line = '[[;#fff;]Lorem ipsum dolor sit amet], consectetur adipiscing elit. [[;#fee;]Cras ultrices rhoncus hendrerit.] Nunc ligula eros, tincidunt posuere tristique quis, [[;#fff;]iaculis non elit.]';
                term.echo(line);
                var output = last_div(term);
                expect(output.find('span').length).toEqual(5); // 3 formattings and 2 between
                expect(output.find('div').length).toEqual(1);
            });
        });
        describe('checkArity', function() {
            var interpreter = {
                foo: function(a, b) {
                    a = a || 10;
                    b = b || 10;
                    this.echo(a + b);
                }
            };
            var term = $('<div/>').terminal(interpreter, {
                greetings: false,
                checkArity: false
            });
            it('should call function with no arguments', function() {
                spy(interpreter, 'foo');
                enter(term, 'foo');
                expect(interpreter.foo).toHaveBeenCalledWith();
            });
            it('should call function with one argument', function() {
                spy(interpreter, 'foo');
                enter(term, 'foo 10');
                expect(interpreter.foo).toHaveBeenCalledWith(10);
            });
        });
        describe('raw', function() {
            var term = $('<div/>').terminal($.noop, {
                raw: true
            });
            beforeEach(function() {
                term.clear();
            });
            var img = '<img src="http://lorempixel.com/300/200/cats/"/>';
            it('should display html when no raw echo option is specified', function() {
                term.echo(img);
                expect(last_div(term).find('img').length).toEqual(1);
            });
            it('should display html as text when using raw echo option', function() {
                term.echo(img, {raw: false});
                var output = last_div(term);
                expect(output.find('img').length).toEqual(0);
                expect(output.text().replace(/\s/g, ' ')).toEqual(img);
            });
        });
        describe('exceptionHandler', function() {
            var test = {
                exceptionHandler: function(e) {
                }
            };
            var exception = new Error('some exception');
            it('should call exception handler with thrown error', function() {
                spy(test, 'exceptionHandler');
                try {
                    var term = $('<div/>').terminal(function() {
                        throw exception;
                    }, {
                        greetings: false,
                        exceptionHandler: test.exceptionHandler
                    });
                } catch(e) {}
                enter(term, 'foo');
                expect(term.find('.error').length).toEqual(0);
                expect(test.exceptionHandler).toHaveBeenCalledWith(exception, 'USER');
            });
        });
        describe('pauseEvents', function() {
            var options = {
                pauseEvents: false,
                keypress: function(e) {
                },
                keydown: function(e) {
                }
            };
            var term;
            beforeEach(function() {
                spy(options, 'keypress');
                spy(options, 'keydown');
            });
            it('should execute keypress and keydown when terminal is paused', function() {
                term = $('<div/>').terminal($.noop, options);
                term.pause();
                shortcut(false, false, false, 32, ' ');
                expect(options.keypress).toHaveBeenCalled();
                expect(options.keydown).toHaveBeenCalled();
            });
            it('should not execute keypress and keydown', function() {
                options.pauseEvents = true;
                term = $('<div/>').terminal($.noop, options);
                term.pause();
                shortcut(false, false, false, 32, ' ');
                expect(options.keypress).not.toHaveBeenCalled();
                expect(options.keydown).not.toHaveBeenCalled();
            });
        });
    });
    describe('terminal create / terminal destroy', function() {
        var term = $('<div/>').appendTo('body').terminal();
        it('should create terminal', function() {
            expect(term.length).toBe(1);
        });
        it('should have proper elements', function() {
            expect(term.hasClass('terminal')).toBe(true);
            expect(term.find('.terminal-output').length).toBe(1);
            expect(term.find('.cmd').length).toBe(1);
            var prompt = term.find('.prompt');
            expect(prompt.length).toBe(1);
            expect(prompt.is('span')).toBe(true);
            expect(prompt.children().length).toBe(1);
            var cursor = term.find('.cursor');
            expect(cursor.length).toBe(1);
            expect(cursor.is('span')).toBe(true);
            expect(cursor.prev().is('span')).toBe(true);
            expect(cursor.next().is('span')).toBe(true);
            term.focus().cmd().enable();
            //this check sometimes fail in travis
            //expect(cursor.hasClass('blink')).toBe(true);
            expect(term.find('.clipboard').length).toBe(1);
        });
        it('should have signature', function() {
            var sig = term.find('.terminal-output div div').map(function() { return $(this).text(); }).get().join('\n');
            expect(nbsp(term.signature())).toEqual(sig);
        });
        it('should have default prompt', function() {
            var prompt = term.find('.prompt');
            expect(prompt.html()).toEqual("<span>&gt;&nbsp;</span>");
            expect(prompt.text()).toEqual(nbsp('> '));
        });
        it('should destroy terminal', function() {
            term.destroy();
            expect(term.children().length).toBe(0);
            term.remove();
        });
        it('should create multiple terminals', function() {
            var divs = $('<div><div/><div/></div>');
            divs.find('div').terminal();
            expect(divs.find('.terminal').length).toEqual(2);
        });
        it('should return previously created terminal', function() {
            var div = $('<div/>');
            div.terminal();
            var test = {
                fn: $.noop
            };
            spy(test, 'fn');
            var term = div.terminal($.noop, {
                onInit: test.fn
            });
            expect(test.fn).not.toHaveBeenCalled();
            expect(typeof term.login).toEqual('function');
        });
        it('should throw exception on empty selector', function() {
            var strings = $.terminal.defaults.strings;
            var error = new $.terminal.Exception(strings.invalidSelector);
            expect(function() {
                $('#notExisting').terminal();
            }).toThrow(error);
        });
    });
    describe('cursor', function() {
        it('only one terminal should have blinking cursor', function(done) {
            var term1 = $('<div/>').appendTo('body').terminal($.noop);
            term1.focus();
            var term2 = $('<div/>').appendTo('body').terminal($.noop);
            term1.pause();
            term2.focus();
            setTimeout(function() {
                term1.resume();
                expect($('.cursor.blink').length).toEqual(1);
                term1.destroy().remove();
                term2.destroy().remove();
                done();
            }, 100);
        });
    });
    describe('observers', function() {
        var i_callback, m_callback, test, term;
        function init() {
            beforeEach(function() {
                test = {
                    fn: $.noop
                };
                spy(test, 'fn');
                window.IntersectionObserver = function(callback) {
                    i_callback = callback;
                    return {
                        observe: function() {
                        },
                        unobserve: function() {
                            i_callback = null;
                        }
                    };
                };
                window.MutationObserver = function(callback) {
                    m_callback = callback;
                    return {
                        observe: function() {
                        },
                        disconnect: function() {
                            m_callback = null;
                        }
                    };
                };
                global.IntersectionObserver = window.IntersectionObserver;
                term = $('<div/>').appendTo('body').terminal($.noop, {
                    onResize: test.fn
                });
            });
            afterEach(function() {
                term.destroy().remove();
                // we only need observers in this tests
                delete global.IntersectionObserver;
                delete window.IntersectionObserver;
                delete window.MutationObserver;
            });
        }
        describe('MutationObserver', function() {
            init();
            it('should call resize', function() {
                term.detach();
                m_callback();
                term.appendTo('body');
                m_callback();
                expect(test.fn).toHaveBeenCalled();
            });
        });
        describe('IntersectionObserver', function() {
            init();
            it('should enable/disable terminal', function() {
                expect(term.enabled()).toBe(true);
                i_callback();
                term.hide();
                i_callback();
                expect(term.enabled()).toBe(false);
                term.show();
                i_callback();
                expect(term.enabled()).toBe(true);
            });
            it('should call resize', function() {
                i_callback();
                term.hide();
                i_callback();
                term.show();
                i_callback();
                expect(test.fn).toHaveBeenCalled();
            });
        });
    });
    describe('events', function() {
        describe('click', function() {
            var term = $('<div/>').terminal();
            it('should move cursor to click position', function(done) {
                term.insert('foo bar').focus();
                var pos = 2;
                var node = term.find('.cmd .cursor-line > span:eq(0) span:eq(' + pos + ')');
                var e = new $.Event('mouseup');
                e.button = 0;
                node.trigger('mousedown').trigger(e);
                setTimeout(function() {
                    expect(term.get_position()).toBe(pos);
                    done();
                }, 300);
            });
        });
        describe('contextmenu', function() {
            var term = $('<div/>').terminal();
            it('should move textarea', function(done) {
                var cmd = term.cmd();
                var clip = term.find('textarea');
                var event = new $.Event('contextmenu');
                expect(clip.attr('style')).toBeFalsy();
                event.pageX = 100;
                event.pageY = 100;
                cmd.trigger(event);
                expect(clip.attr('style')).toBeTruthy();
                setTimeout(function() {
                    expect(clip.attr('style')).toBeFalsy();
                    done();
                }, 200);
            });
        });
        describe('input', function() {
            var doc = $(document.documentElement || window);
            it('should trigger keypress from input', function(done) {
                // trigger input without keypress
                var term = $('<div/>').terminal();
                term.focus();
                var clip = term.find('textarea');
                clip.val(clip.val() + 'a');
                doc.one('keypress', function(e) {
                    expect(e.key).toEqual('a');
                    setTimeout(function() {
                        expect(term.get_command()).toEqual('a');
                        done();
                    }, 200);
                });
                doc.trigger(keydown(false, false, false, 'a'));
                doc.trigger('input');
            });
            it('should trigger keydown from input', function(done) {
                // trigger input without keydown
                var term = $('<div/>').terminal();
                term.focus();
                term.insert('foo bar');
                var clip = term.find('textarea');
                clip.val(clip.val().replace(/.$/, ''));
                doc.one('keydown', function(e) {
                    expect(e.which).toBe(8);
                    setTimeout(function() {
                        expect(term.get_command()).toEqual('foo ba');
                        // the code before will trigger dead key - in Android it's always
                        // no keypress or no keydown for all keys
                        doc.trigger(keypress('a'));
                        done();
                    }, 200);
                });
                doc.trigger('input');
            });
        });
        describe('enter text', function() {
            var interpreter = {
                foo: function() {
                }
            };
            var term = $('<div/>').appendTo('body').terminal(interpreter);
            it('text should appear and interpreter function should be called', function() {
                term.focus(true);
                spy(interpreter, 'foo');
                enter_text('foo');
                expect(term.get_command()).toEqual('foo');
                enter_key();
                expect(interpreter.foo).toHaveBeenCalled();
                var last_div = term.find('.terminal-output > div:last-child');
                expect(last_div.hasClass('command')).toBe(true);
                expect(last_div.children().html()).toEqual('<span>&gt;&nbsp;foo</span>');
                term.destroy().remove();
            });
        });
    });
    describe('prompt', function() {
        var term = $('<div/>').appendTo('body').terminal($.noop, {
            prompt: '>>> '
        });
        it('should return prompt', function() {
            expect(term.get_prompt()).toEqual('>>> ');
            expect(term.find('.prompt').html()).toEqual('<span>&gt;&gt;&gt;&nbsp;</span>');
        });
        it('should set prompt', function() {
            term.set_prompt('||| ');
            expect(term.get_prompt()).toEqual('||| ');
            expect(term.find('.prompt').html()).toEqual('<span>|||&nbsp;</span>');
            function prompt(callback) {
                callback('>>> ');
            }
            term.set_prompt(prompt);
            expect(term.get_prompt()).toEqual(prompt);
            expect(term.find('.prompt').html()).toEqual('<span>&gt;&gt;&gt;&nbsp;</span>');
        });
        it('should format prompt', function() {
            var prompt = '<span style="font-weight:bold;text-decoration:underline;color:#fff;" data-text=">>>">&gt;&gt;&gt;</span><span>&nbsp;</span>';
            term.set_prompt('[[ub;#fff;]>>>] ');
            expect(term.find('.prompt').html()).toEqual(prompt);
            term.set_prompt(function(callback) {
                callback('[[ub;#fff;]>>>] ');
            });
            expect(term.find('.prompt').html()).toEqual(prompt);
            term.destroy().remove();
        });
    });
    describe('cmd plugin', function() {
        var term = $('<div/>').appendTo('body').css('overflow-y', 'scroll').terminal($.noop, {
            name: 'cmd',
            numChars: 150,
            numRows: 20
        });
        var string = '';
        for (var i=term.cols(); i--;) {
            term.insert('M');
        }
        var cmd = term.cmd();
        var line = cmd.find('.prompt').next();
        it('text should have 2 lines', function() {
            expect(line.is('div')).toBe(true);
            expect(line.text().length).toBe(term.cols()-2);
        });
        it('cmd plugin moving cursor', function() {
            cmd.position(-8, true);
            var cursor_line = cmd.find('.cursor-line');
            var cursor = cmd.find('.cursor');
            var before = cursor.prev();
            var after = cursor.next();
            expect(before.is('span')).toBe(true);
            expect(before.text().length).toBe(term.cols()-8);
            expect(cursor_line.next().text().length).toBe(2);
            expect(after.text().length).toBe(5);
            expect(cursor.text()).toBe('M');
        });
        it('should remove characters', function() {
            cmd['delete'](-10);
            var cursor = cmd.find('.cursor');
            var before = cursor.prev();
            var after = cursor.next();
            expect(before.text().length).toEqual(term.cols()-8-10);
            cmd['delete'](8);
            expect(cursor.text()).toEqual('\xA0');
            expect(after.text().length).toEqual(0);
        });
        var history = cmd.history();
        it('should have one entry in history', function() {
            cmd.purge();
            term.set_command('something').focus(true);
            enter_key();
            expect(history.data()).toEqual(['something']);
        });
        it('should not add item to history if history is disabled', function() {
            history.disable();
            term.set_command('something else');
            enter_key();
            expect(history.data()).toEqual(['something']);
        });
        it('should remove commands from history', function() {
            spy(history, 'purge');
            cmd.purge();
            expect(history.purge).toHaveBeenCalled();
            expect(history.data()).toEqual([]);
        });
        it('should have name', function() {
            expect(cmd.name()).toEqual('cmd_' + term.id());
        });
        it('should return command', function() {
            cmd.set('foo');
            expect(cmd.get()).toEqual('foo');
        });
        it('should not move position', function() {
            var pos = cmd.position();
            cmd.insert('bar', true);
            expect(cmd.position()).toEqual(pos);
        });
        it('should return $.noop for commands', function() {
            expect($.terminal.active().commands()).toEqual($.noop);
        });
        it('should set position', function() {
            cmd.position(0);
            expect(cmd.position()).toEqual(0);
        });
        it('should set and remove mask', function() {
            cmd.mask('•');
            cmd.position(6);
            var before = cmd.find('.cursor').prev();
            expect(before.text()).toEqual('••••••');
            expect(cmd.get()).toEqual('foobar');
            cmd.mask(false);
            expect(before.text()).toEqual('foobar');
        });
        it('should execute functions on shortcuts', function() {
            spy(cmd, 'position');
            shortcut(true, false, false, 65, 'a'); // CTRL+A
            expect(cmd.position).toHaveBeenCalled();
            spy(cmd, 'delete');
            shortcut(true, false, false, 75, 'k'); // CTRL+K
            expect(cmd['delete']).toHaveBeenCalled();
            spy(cmd, 'insert');
            shortcut(true, false, false, 89, 'y'); // CTRL+Y
            expect(cmd.insert).toHaveBeenCalled();
            shortcut(true, false, false, 85, 'u'); // CTRL+U
            expect(cmd.kill_text()).toEqual('foobar');
            shortcut(false, false, true, 13, 'enter');
            expect(cmd.find('.prompt').next().text()).toEqual('\xA0');
            expect(cmd.get()).toEqual('\n');
            cmd.set('');
            shortcut(false, false, false, 9, 'tab'); // TAB
            expect(cmd.get()).toEqual('\t');
            history.enable();
            cmd.set('foo bar');
            enter_key();
            shortcut(false, false, false, 38, 'ArrowUp'); // UP ARROW
            expect(cmd.get()).toEqual('foo bar');
            shortcut(false, false, false, 40, 'arrowDown'); // DOWN ARROW
            expect(cmd.get()).toEqual('');
            cmd.insert('hello');
            shortcut(false, false, false, 38, 'arrowUp');
            shortcut(false, false, false, 40, 'arrowDown');
            expect(cmd.get()).toEqual('hello');
            shortcut(false, false, false, 38, 'arrowUp');
            enter_key();
            shortcut(false, false, false, 38, 'arrowUp');
            expect(cmd.get()).toEqual('foo bar');
            enter_key();
            shortcut(false, false, false, 38, 'arrowUp');
            expect(cmd.get()).toEqual('foo bar');
            shortcut(false, false, false, 40, 'arrowDown');
            cmd.insert('hello');
            shortcut(true, false, false, 80, 'p'); // CTRL+P
            expect(cmd.get()).toEqual('foo bar');
            shortcut(true, false, false, 78, 'n'); // CTRL+N
            expect(cmd.get()).toEqual('hello');
            cmd.set('foo bar baz');
            shortcut(false, false, false, 37, 'arrowleft'); // LEFT ARROW
            expect(cmd.position()).toEqual(10);
            shortcut(true, false, false, 37, 'arrowleft'); // moving by words
            expect(cmd.position()).toEqual(8);
            shortcut(true, false, false, 37, 'arrowleft');
            expect(cmd.position()).toEqual(4);
            shortcut(true, false, false, 37, 'arrowleft');
            expect(cmd.position()).toEqual(0);
            shortcut(false, false, false, 39, 'arrowright'); // RIGHT ARROW
            expect(cmd.position()).toEqual(1);
            shortcut(true, false, false, 39, 'arrowright');
            expect(cmd.position()).toEqual(3);
            shortcut(true, false, false, 39, 'arrowright');
            expect(cmd.position()).toEqual(7);
            shortcut(true, false, false, 39, 'arrowright');
            expect(cmd.position()).toEqual(11);
            shortcut(false, false, false, 36, 'home'); // HOME
            expect(cmd.position()).toEqual(0);
            shortcut(false, false, false, 35, 'end'); // END
            expect(cmd.position()).toEqual(cmd.get().length);
            shortcut(true, false, false, 82, 'r'); // CTRL+R
            expect(cmd.prompt()).toEqual("(reverse-i-search)`': ");
            enter_text('foo');
            expect(cmd.get()).toEqual('foo bar');
            shortcut(true, false, false, 71, 'g'); // CTRL+G
            expect(cmd.get()).toEqual('foo bar baz');
            expect(cmd.prompt()).toEqual("> ");
            shortcut(true, false, false, 82, 'r'); // CTRL+R
            expect(cmd.prompt()).toEqual("(reverse-i-search)`': ");
            shortcut(false, false, false, 36, 'Home');
            expect(cmd.prompt()).toEqual("> ");
            cmd.purge();
            term.destroy().remove();
        });
    });
    function AJAXMock(url, response, options) {
        var ajax = $.ajax;
        options = $.extend({}, {
            async: false
        }, options);
        $.ajax = function(obj) {
            function done() {
                if (!canceled) {
                    if ($.isFunction(obj.success)) {
                        obj.success(response, 'OK', {
                            getResponseHeader: function(header) {
                                if (header == 'Content-Type') {
                                    return 'application/json';
                                }
                            },
                            responseText: response
                        });
                    }
                    defer.resolve(response);
                }
            }
            if (obj.url == url) {
                var defer = $.Deferred();
                var canceled = false;
                var jqXHR = {
                    abort: function() {
                        canceled = true;
                    }
                };
                $(document).trigger("ajaxSend", [ jqXHR, obj ] );
                try {
                    if ($.isFunction(obj.beforeSend)) {
                        obj.beforeSend({}, obj);
                    }
                    if (options.async) {
                        var num = +options.async;
                        setTimeout(done, isNaN(num) ? 100 : num);
                    } else {
                        done();
                    }
                } catch (e) {
                    throw new Error(e.message);
                }
                return defer.promise();
            } else {
                return ajax.apply($, arguments);
            }
        };
    }
    function JSONRPCMock(url, object, options) {
        var defaults = {
            no_system_describe: false,
            async: false,
            error: $.noop
        };
        var settings = $.extend({}, defaults, options);
        var ajax = $.ajax;
        var system = {
            'sdversion': '1.0',
            'name': 'DemoService',
            'address': url,
            // md5('JSONRPCMock')
            'id': 'urn:md5:e1a975ac782ce4ed0a504ceb909abf44',
            'procs': []
        };
        for (var key in object) {
            var proc = {
                name: key
            };
            if ($.isFunction(object[key])) {
                var re = /function[^\(]+\(([^\)]+)\)/;
                var m = object[key].toString().match(re);
                if (m) {
                    proc.params = m[1].split(/\s*,\s*/);
                }
            }
            system.procs.push(proc);
        }
        $.ajax = function(obj) {
            function done() {
                if ($.isFunction(obj.success)) {
                    obj.success(resp, 'OK', {
                        getResponseHeader: function(header) {
                            if (header == 'Content-Type') {
                                return 'application/json';
                            }
                        }
                    });
                }
                defer.resolve(resp);
            }
            if (obj.url == url) {
                var defer = $.Deferred();
                try {
                    obj.beforeSend({}, obj);
                    var req = JSON.parse(obj.data);
                    var resp;
                    if (req.method == 'system.describe') {
                        if (!settings.no_system_describe) {
                            resp = system;
                        } else {
                            var data = obj.data;
                            if (typeof data == 'string') {
                                data = JSON.parse(data);
                            }
                            resp = {
                                "jsonrpc": "2.0",
                                "result": null,
                                "id": data.id,
                                "error": {
                                    "code": -32601,
                                    "message": "There is no system.describe method"
                                }
                            };
                        }
                    } else {
                        var error = null;
                        var ret = null;
                        try {
                            if ($.isFunction(object[req.method])) {
                                ret = object[req.method].apply(null, req.params);
                            } else {
                                ret = null;
                                error = {
                                    "code": -32601,
                                    "message": "There is no `" + req.method + "' method"
                                };
                            }
                        } catch (e) {
                            error = {
                                message: e.message,
                                error: {
                                    file: '/foo/bar/baz.php',
                                    at: 10,
                                    message: 'Syntax Error'
                                }
                            };
                        }
                        resp = {
                            id: req.id,
                            jsonrpc: '1.1',
                            result: ret,
                            error: error
                        };
                    }
                    resp = JSON.stringify(resp);
                    if (settings.async) {
                        setTimeout(done, 100);
                    } else {
                        done();
                    }
                } catch (e) {
                    throw new Error(e.message);
                }
                return defer.promise();
            } else {
                return ajax.apply($, arguments);
            }
        };
    }
    var token = 'TOKEN';
    var exception = 'Some Exception';
    var object = {
        echo: function(token, str) {
            return str;
        },
        foo: function(token, obj) {
            return obj;
        },
        exception: function(token) {
            throw new Error(exception);
        },
        login: function(user, password) {
            if (user == 'demo' && password == 'demo') {
                return token;
            } else {
                return null;
            }
        }
    };
    AJAXMock('/not-json', 'Response', {async: true});
    AJAXMock('/not-rpc', '{"foo": "bar"}', {async: true});
    JSONRPCMock('/test', object);
    JSONRPCMock('/no_describe', object, {no_system_describe: true});
    JSONRPCMock('/async', object, {async: true});
    describe('JSON-RPC', function() {
        var term = $('<div/>').appendTo('body').terminal('/test', {
            login: true
        });
        it('should call login', function() {
            if (term.token()) {
                term.logout();
            }
            term.focus();
            spy(object, 'login');
            enter(term, 'test');
            enter(term, 'test');
            var last_div = term.find('.terminal-output > div:last-child');
            expect(last_div.text()).toEqual('Wrong password try again!');
            expect(object.login).toHaveBeenCalledWith('test', 'test');
            enter(term, 'demo');
            enter(term, 'demo');
            expect(object.login).toHaveBeenCalledWith('demo', 'demo');
            expect(term.token()).toEqual(token);
        });
        it('should call a function', function() {
            term.focus();
            spy(object, 'echo');
            enter(term, 'echo hello');
            expect(object.echo).toHaveBeenCalledWith(token, 'hello');
            term.destroy().remove();
        });
        describe('No system.describe', function() {
            it('should call login rpc method', function() {
                term = $('<div/>').appendTo('body').terminal('/no_describe', {
                    login: true
                });
                if (term.token()) {
                    term.logout();
                }
                spy(object, 'login');
                enter(term, 'demo');
                enter(term, 'demo');
                expect(object.login).toHaveBeenCalledWith('demo', 'demo');
            });
            it('should pass TOKEN to method', function() {
                spy(object, 'echo');
                enter(term, 'echo hello');
                expect(object.echo).toHaveBeenCalledWith(token, 'hello');
                term.destroy().remove();
            });
            it('should call login function', function() {
                var options = {
                    login: function(user, password, callback) {
                        if (user == 'foo' && password == 'bar') {
                            callback(token);
                        } else {
                            callback(null);
                        }
                    }
                };
                spy(options, 'login');
                spy(object, 'echo');
                term = $('<div/>').appendTo('body').terminal('/no_describe',
                                                             options);
                if (term.token()) {
                    term.logout();
                }
                enter(term, 'test');
                enter(term, 'test');
                expect(options.login).toHaveBeenCalled();
                expect(term.token()).toBeFalsy();
                enter(term, 'foo');
                enter(term, 'bar');
                expect(options.login).toHaveBeenCalled();
                expect(term.token()).toEqual(token);
                enter(term, 'echo hello');
                expect(object.echo).toHaveBeenCalledWith(token, 'hello');
                term.destroy().remove();
            });
            it('should ignore system.describe method', function() {
                term = $('<div/>').appendTo('body').terminal('/test', {
                    ignoreSystemDescribe: true,
                    completion: true
                });
                expect(term.export_view().interpreters.top().completion).toBeFalsy();
                term.destroy().remove();
            });
            it('should display error on invalid JSON', function(done) {
                var term = $('<div/>').appendTo('body').terminal('/not-json', {greetings: false});
                setTimeout(function() {
                    enter(term, 'foo');
                    setTimeout(function() {
                        var output = [
                            '> foo',
                            '[[;;;error]&#91;AJAX&#93; Invalid JSON - Server responded:',
                            'Response]'
                        ].join('\n');
                        expect(term.get_output()).toEqual(output);
                        term.destroy().remove();
                        done();
                    }, 200);
                }, 200);
            });
            it('should display error on Invalid JSON-RPC response', function(done) {
                var term = $('<div/>').appendTo('body').terminal('/not-rpc', {
                    greetings: false
                });
                setTimeout(function() {
                    enter(term, 'foo');
                    setTimeout(function() {
                        var output = [
                            '> foo',
                            '[[;;;error]&#91;AJAX&#93; Invalid JSON-RPC - Server responded:',
                            '{"foo": "bar"}]'
                        ].join('\n');
                        expect(term.get_output()).toEqual(output);
                        term.destroy().remove();
                        done();
                    }, 200);
                }, 200);
            });
        });
    });
    describe('cancelable ajax requests', function() {
        var term = $('<div/>').terminal({}, {greetings: false});
        AJAXMock('/500ms', 'foo bar', {async: 500});
        it('should cancel ajax request', function(done) {
            var test = {
                fn: function() {
                }
            };
            spy(test, 'fn');
            term.focus().pause();
            $.get('/500ms', function(data) {
                test.fn(data);
            });
            shortcut(true, false, false, 'D');
            expect(term.paused()).toBeFalsy();
            setTimeout(function() {
                expect(output(term)).toEqual([]);
                expect(test.fn).not.toHaveBeenCalled();
                done();
            }, 600);
        });
    });
    describe('nested object interpreter', function() {
        var interpereter, type, fallback, term;
        beforeEach(function() {
            fallback = {
                interpreter: function(command, term) { }
            };
            interpereter = {
                foo: {
                    bar: {
                        baz: function() {
                        },
                        add: function(a, b) {
                            this.echo(a+b);
                        },
                        type: function(obj) {
                            type.test(obj.constructor);
                            this.echo(JSON.stringify([].slice.call(arguments)));
                        }
                    }
                },
                quux: '/test'
            };
            type = {
                test: function(obj) { }
            };
            term = $('<div/>').appendTo('body').terminal(interpereter);
            term.focus();
        });
        afterEach(function() {
            term.destroy().remove();
            term = null;
        });
        it('should created nested intepreter', function() {
            term.focus();
            var spy = spyOn(interpereter.foo.bar, 'baz');
            enter(term, 'foo');
            expect(term.get_prompt()).toEqual('foo> ');
            enter(term, 'bar');
            expect(term.get_prompt()).toEqual('bar> ');
            enter(term, 'baz');
            expect(interpereter.foo.bar.baz).toHaveBeenCalled();
        });
        it('should convert arguments', function() {
            spy(type, 'test');
            term.exec(['foo', 'bar']);
            term.insert('add 10 20');
            enter_key();
            var last_div = term.find('.terminal-output > div:last-child');
            expect(last_div.text()).toEqual('30');
            enter(term, 'type /foo/gi');
            expect(type.test).toHaveBeenCalledWith(RegExp);
            enter(term, 'type 10');
            expect(type.test).toHaveBeenCalledWith(Number);
        });
        it('should show error on wrong arity', function() {
            term.exec(['foo', 'bar']);
            enter(term, 'type 10 20');
            var last_div = term.find('.terminal-output > div:last-child');
            expect(last_div.text()).toEqual("[Arity] Wrong number of arguments." +
                                            " Function 'type' expects 1 got 2!");
        });
        it('should call fallback function', function() {
            spy(fallback, 'interpreter');
            term.destroy().remove();
            term = $('<div/>').appendTo('body').terminal([
                interpereter, fallback.interpreter
            ], {
                checkArity: false
            });
            enter(term, 'baz');
            expect(fallback.interpreter).toHaveBeenCalledWith('baz', term);
        });
        it('should not show error on wrong arity', function() {
            term.destroy().remove();
            term = $('<div/>').appendTo('body').terminal([
                interpereter, fallback.interpreter
            ], {
                checkArity: false
            });
            spy(type, 'test');
            enter(term, 'foo');
            enter(term, 'bar');
            enter(term, 'type 10 20');
            expect(type.test).toHaveBeenCalled();
        });
        it('should call json-rpc', function() {
            spy(object, 'echo');
            enter(term, 'quux');
            expect(term.get_prompt()).toEqual('quux> ');
            // for unknown reason cmd have visibility set to hidden
            term.cmd().enable().visible();
            enter(term, 'echo foo bar');
            expect(object.echo).toHaveBeenCalledWith('foo', 'bar');
            var new_term = $('<div/>').appendTo('body').terminal([
                interpereter, '/test', fallback.interpreter
            ]);
            new_term.focus();
            enter(new_term, 'echo TOKEN world'); // we call echo without login
            expect(object.echo).toHaveBeenCalledWith('TOKEN', 'world');
        });
        it('should show error', function() {
            term.clear();
            enter(term, 'quux');
            enter(term, 'exception TOKEN');
            var last_div = term.find('.terminal-output > div:last-child');
            expect(output(term)).toEqual([
                '> quux',
                'quux> exception TOKEN',
                '[RPC] ' +exception,
                '    Syntax Error in file "baz.php" at line 10'
            ]);
        });
        it('should show parse error on unclosed string', function() {
            var commands = [
                'foo foo"',
                'foo "foo\\"foo',
                "foo 'foo",
                "foo 'foo\\'foo"
            ];
            commands.forEach(function(command) {
                term.focus().clear();
                enter(term, command);
                expect(output(term)).toEqual([
                    '> ' + command,
                    'Error: Command `' + command + '` have unclosed strings'
                ]);
            });
        });
    });
    describe('jQuery Terminal object', function() {
        var test = {
            test: function(term) {}
        };
        var term = $('<div/>').appendTo('body').terminal([{
            foo: function() {
                test.test(this);
            }
        }, function(cmd, term) {
            test.test(term);
        }]);
        it('value returned by plugin should be the same as in intepreter', function() {
            term.focus();
            var spy = spyOn(test, 'test');
            enter(term, 'foo');
            expect(test.test).toHaveBeenCalledWith(term);
            enter(term, 'bar');
            expect(test.test).toHaveBeenCalledWith(term);
            term.destroy().remove();
        });
    });
    describe('Completion', function() {
        var term = $('<div/>').appendTo('body').terminal($.noop, {
            name: 'completion',
            greetings: false,
            completion: ['foo', 'bar', 'baz', 'lorem ipsum']
        });
        it('should complete text for main intepreter', function() {
            term.focus();
            term.insert('f');
            shortcut(false, false, false, 9, 'tab');
            expect(term.get_command()).toEqual('foo');
            term.set_command('');
            term.insert('lorem\\ ');
            shortcut(false, false, false, 9, 'tab');
            expect(term.get_command()).toEqual('lorem\\ ipsum');
        });
        it('should complete text for nested intepreter', function() {
            term.push($.noop, {
                completion: ['lorem', 'ipsum', 'dolor']
            });
            term.insert('l');
            shortcut(false, false, false, 9, 'tab');
            expect(term.get_command()).toEqual('lorem');
        });
        it('should complete when completion is a function with setTimeout', function(done) {
            var term = $('<div/>').appendTo('body').terminal($.noop);
            term.push($.noop, {
                completion: function(string, callback) {
                    setTimeout(function() {
                        callback(['one', 'two', 'tree']);
                    }, 100);
                }
            });
            term.set_command('');
            term.insert('o').focus();
            shortcut(false, false, false, 9, 'tab');
            setTimeout(function() {
                expect(term.get_command()).toEqual('one');
                term.destroy().remove();
                done();
            }, 400);
        });
        function completion(string, callback) {
            var command = term.get_command();
            var cmd = $.terminal.parse_command(command);
            var re = new RegExp('^\\s*' + $.terminal.escape_regex(string));
            if (command.match(re)) {
                callback(['foo', 'bar', 'baz', 'lorem ipsum']);
            } else if (cmd.name == 'foo') {
                callback(['one', 'two', 'tree']);
            } else {
                callback(['four', 'five', 'six']);
            }
        }
        it('should complete argument', function() {
            term.focus().push($.noop, {completion: completion});
            term.set_command('');
            term.insert('foo o');
            shortcut(false, false, false, 9, 'tab');
            expect(term.get_command()).toEqual('foo one');
            term.pop();
        });
        it('should complete in the middle of the word', function() {
            term.push($.noop, {completion: completion});
            term.set_command('f one');
            var cmd = term.cmd();
            cmd.position(1);
            shortcut(false, false, false, 9, 'tab');
            expect(term.get_command()).toEqual('foo one');
            var command = 'lorem\\ ip';
            term.set_command(command +' one');
            cmd.position(command.length);
            shortcut(false, false, false, 9, 'tab');
            expect(term.get_command()).toEqual('lorem\\ ipsum one');
        });
        it('should complete rpc method', function() {
            term.push('/test', {
                completion: true
            });
            term.set_command('').resume().focus();
            term.insert('ec');
            shortcut(false, false, false, 9, 'tab');
            expect(term.get_command()).toEqual('echo');
        });
        it('should complete command from array when used with JSON-RPC', function() {
            term.push('/test', {
                completion: ['foo', 'bar', 'baz']
            });
            term.focus().resume().set_command('');
            term.insert('f');
            shortcut(false, false, false, 9, 'tab');
            expect(term.get_command()).toEqual('foo');
        });
        it('should insert tab when RPC used without system.describe', function(done) {
            term.push('/no_describe', {
                completion: true
            });
            setTimeout(function() {
                term.focus().set_command('').cmd().enable().visible();
                term.insert('f');
                shortcut(false, false, false, 9, 'tab');
                expect(term.get_command()).toEqual('f\t');
                term.destroy().remove();
                done();
            }, 200);
        });
        it('should insert tab when ignoreSystemDescribe', function() {
            term = $('<div/>').appendTo('body').terminal('/test', {
                ignoreSystemDescribe: true,
                completion: true
            });
            term.insert('f');
            shortcut(false, false, false, 9, 'tab');
            expect(term.get_command()).toEqual('f\t');
            term.destroy().remove();
        });
        it('should not complete by default for json-rpc', function() {
            term = $('<div/>').appendTo('body').terminal('/test');
            term.focus();
            term.insert('ec');
            shortcut(false, false, false, 9, 'tab');
            expect(term.get_command()).toEqual('ec\t');
            term.destroy().remove();
        });
        it('should complete text with spaces inside quotes', function() {
            term = $('<div/>').appendTo('body').terminal({}, {
                completion: ['foo bar baz']
            });
            term.focus();
            term.insert('asd foo\\ b');
            shortcut(false, false, false, 9, 'tab');
            expect(term.get_command()).toEqual('asd foo\\ bar\\ baz');
            term.destroy().remove();
        });
        it('should complete text that have spaces inside double quote', function() {
            term = $('<div/>').appendTo('body').terminal({}, {
                completion: ['foo bar baz']
            });
            term.focus();
            term.insert('asd "foo b');
            shortcut(false, false, false, 9, 'tab');
            expect(term.get_command()).toEqual('asd "foo bar baz"');
            term.destroy().remove();
        });
        it('should complete when text have escaped quotes', function() {
            term = $('<div/>').appendTo('body').terminal({}, {
                completion: ['foo "bar" baz']
            });
            term.focus();
            term.insert('asd "foo');
            shortcut(false, false, false, 9, 'tab');
            expect(term.get_command()).toEqual('asd "foo \\"bar\\" baz"');
            term.destroy().remove();
        });
        it('should complete when text have double quote inside single quotes', function() {
            term = $('<div/>').appendTo('body').terminal({}, {
                completion: ['foo "bar" baz']
            });
            term.focus();
            term.insert("asd 'foo");
            shortcut(false, false, false, 9, 'tab');
            expect(term.get_command()).toEqual("asd 'foo \"bar\" baz'");
            term.destroy().remove();
        });
        it('should complete when text have single quote inside double quotes', function() {
            term = $('<div/>').appendTo('body').terminal({}, {
                completion: ["foo 'bar' baz"]
            });
            term.focus();
            term.insert('asd "foo');
            shortcut(false, false, false, 9, 'tab');
            expect(term.get_command()).toEqual("asd \"foo 'bar' baz\"");
            term.destroy().remove();
        });
        it('should complete when function returm promise', function(done) {
            term = $('<div/>').appendTo('body').terminal({}, {
                completion: function() {
                    return new Promise(function(resolve) {
                        setTimeout(function() {
                            resolve(["foo", "bar", "baz"]);
                        }, 200);
                    });
                }
            });
            term.focus();
            term.insert('f');
            shortcut(false, false, false, 9, 'tab');
            setTimeout(function() {
                expect(term.get_command()).toEqual("foo");
                done();
            }, 400);
        });
    });
    describe('jQuery Terminal methods', function() {
        var terminal_name = 'methods';
        var greetings = 'Hello World!';
        var completion = ['foo', 'bar', 'baz'];
        var exported_view;
        var command = 'baz';
        var prompt = '$ ';
        var mask = '-';
        var position;
        var last_id = $.terminal.last_id();
        var term = $('<div/>').appendTo('body').terminal($.noop, {
            name: terminal_name,
            greetings: greetings,
            completion: completion
        });
        it('should return id of the terminal', function() {
            expect(term.id()).toEqual(last_id + 1);
            term.focus();
        });
        it('should clear the terminal', function() {
            term.clear();
            expect(term.find('.terminal-output').html()).toEqual('');
        });
        it('should save commands in hash', function() {
            location.hash = '';
            term.save_state(); // initial state
            term.save_state('foo');
            term.save_state('bar');
            var id = term.id();
            var hash = '#' + JSON.stringify([[id,1,"foo"],[id,2,"bar"]]);
            expect(decodeURIComponent(location.hash)).toEqual(hash);
            term.destroy().remove();
        });
        describe('import/export view', function() {
            var term = $('<div/>').appendTo('body').terminal($.noop, {
                name: terminal_name,
                greetings: greetings,
                completion: completion
            });
            it('should export view', function() {
                enter(term, 'foo');
                enter(term, 'bar');
                term.insert(command);
                term.set_prompt(prompt);
                term.set_mask(mask);
                position = term.cmd().position();
                exported_view = term.export_view();
                expect(exported_view.prompt).toEqual(prompt);
                expect(exported_view.position).toEqual(position);
                expect(exported_view.focus).toEqual(true);
                expect(exported_view.mask).toEqual(mask);
                expect(exported_view.command).toEqual(command);
                expect(exported_view.lines[0][0]).toEqual('Hello World!');
                expect(exported_view.lines[1][0]).toEqual('> foo');
                expect(exported_view.lines[2][0]).toEqual('> bar');
                expect(exported_view.interpreters.size()).toEqual(1);
                var top = exported_view.interpreters.top();
                expect(top.interpreter).toEqual($.noop);
                expect(top.name).toEqual(terminal_name);
                expect(top.prompt).toEqual(prompt);
                expect(top.greetings).toEqual(greetings);
                expect(top.completion).toEqual('settings');
            });
            it('should import view', function() {
                term.clear().push($.noop).set_prompt('# ')
                    .set_mask(false)
                    .set_command('foo');
                var cmd = term.cmd();
                cmd.position(0);
                term.import_view(exported_view);
                expect(cmd.mask()).toEqual(mask);
                expect(term.get_command()).toEqual(command);
                expect(term.get_prompt()).toEqual(prompt);
                expect(cmd.position()).toEqual(position);
                var html = '<div data-index="0"><div style="width: 100%;"><span>Hello&nbsp;World!</span></div></div>'+
                        '<div data-index="1" class="command" role="presentation" aria-hidden="true">'+
                        '<div style="width: 100%;"><span>&gt;&nbsp;foo</span></div>'+
                        '</div>'+
                        '<div data-index="2" class="command" role="presentation" aria-hidden="true">'+
                        '<div style="width: 100%;"><span>&gt;&nbsp;bar</span></div>'+
                        '</div>';
                expect(term.find('.terminal-output').html()).toEqual(html);
            });
        });
        describe('exec', function() {
            var counter = 0;
            var interpreter = {
                foo: function() {
                    this.pause();
                    setTimeout(function() {
                        this.echo('Hello ' + counter++).resume();
                    }.bind(this), 50);
                },
                bar: function() {
                    var d = $.Deferred();
                    setTimeout(function() {
                        d.resolve('Foo Bar');
                    }, 100);
                    return d.promise();
                },
                baz: {
                    quux: function() {
                        this.echo('quux');
                    }
                }
            };

            var term = $('<div/>').appendTo('body').terminal(interpreter);
            term.focus();
            it('should execute function', function(done) {
                spy(interpreter, 'foo');
                term.exec('foo').then(function() {
                    expect(interpreter.foo).toHaveBeenCalled();
                    done();
                });
            });
            it('should echo text when promise is resolved', function(done) {
                term.exec('bar').then(function() {
                    var last_div = term.find('.terminal-output > div:last-child');
                    expect(last_div.text()).toEqual('Foo Bar');
                    done();
                });
            });
            it('should create nested interpreter', function(done) {
                term.exec('baz').then(function() {
                    expect(term.get_prompt()).toEqual('baz> ');
                    term.exec('quux').then(function() {
                        var last_div = term.find('.terminal-output > div:last-child');
                        expect(last_div.text()).toEqual('quux');
                        term.pop();
                        done();
                    });
                });
            });
            var arr = [];
            for (i = 0; i<10; i++) {
                arr.push('Hello ' + i);
            }
            var test_str = arr.join('\n');
            function text_echoed() {
                return term.find('.terminal-output > div:not(.command)')
                    .map(function() {
                        return $(this).text();
                    }).get().join('\n');
            }
            it('should execute functions in order when using exec.then', function(done) {
                term.clear();
                counter = 0;
                var i = 0;
                (function recur() {
                    if (i++ < 10) {
                        term.exec('foo').then(recur);
                    } else {
                        expect(text_echoed()).toEqual(test_str);
                        done();
                    }
                })();
            }, 10000);
            it('should execute functions in order when used delayed commands', function(done) {
                term.clear();
                counter = 0;
                var promises = [];
                for (var i = 0; i<10; i++) {
                    promises.push(term.exec('foo'));
                }
                $.when.apply($, promises).then(function() {
                    expect(text_echoed()).toEqual(test_str);
                    done();
                });
            }, 10000);
            it('should execute array', function(done) {
                term.clear();
                counter = 0;
                var array = [];
                for (var i = 0; i<10; i++) {
                    array.push('foo');
                }
                term.exec(array).then(function() {
                    expect(text_echoed()).toEqual(test_str);
                    term.destroy().remove();
                    done();
                });
            }, 10000);
            //*/
            it('should login from exec array', function(done) {
                var test = {
                    test: function() {
                    }
                };
                var token = 'TOKEN';
                var options = {
                    login: function(user, password, callback) {
                        if (user == 'foo' && password == 'bar') {
                            callback(token);
                        } else {
                            callback(null);
                        }
                    },
                    name: 'exec_login_array',
                    greetings: false
                };

                spy(test, 'test');
                spy(options, 'login');
                var term = $('<div/>').terminal({
                    echo: function(arg) {
                        test.test(arg);
                    }
                }, options);
                if (term.token()) {
                    term.logout();
                }
                var array = ['foo', 'bar', 'echo foo'];
                term.exec(array).then(function() {
                    expect(options.login).toHaveBeenCalled();
                    expect(test.test).toHaveBeenCalledWith('foo');
                    term.destroy().remove();
                    done();
                });
            });
            it('should login from hash', function(done) {
                var test = {
                    test: function() {
                    }
                };
                var token = 'TOKEN';
                var options = {
                    login: function(user, password, callback) {
                        if (user == 'foo' && password == 'bar') {
                            callback(token);
                        } else {
                            callback(null);
                        }
                    },
                    name: 'exec_login_array',
                    execHash: true,
                    greetings: 'exec'
                };
                var next_id = $.terminal.last_id() + 1;
                location.hash = '#' + JSON.stringify([
                    [next_id,1,"foo"],
                    [next_id,2,"bar"],
                    [next_id,3,"echo foo"]
                ]);
                spy(test, 'test');
                spy(options, 'login');
                var term = $('<div/>').terminal({
                    echo: function(arg) {
                        test.test(arg);
                    }
                }, options);
                if (term.token()) {
                    term.logout();
                }
                setTimeout(function() {
                    try {
                        expect(options.login).toHaveBeenCalled();
                        expect(test.test).toHaveBeenCalledWith('foo');
                        term.logout().destroy().remove();
                    } catch (e) {
                        console.log(e.stack);
                    } finally {
                        done();
                    }
                }, 500);
            }, 5000);
            it('should exec when paused', function(done) {
                var test = {
                    fn: function() {
                    }
                };
                spy(test, 'fn');
                var term = $('<div/>').terminal({
                    echo: function(arg) {
                        test.fn(arg);
                    }
                }, {});
                term.pause();
                term.exec('echo foo');
                expect(test.fn).not.toHaveBeenCalled();
                term.resume();
                setTimeout(function() {
                    expect(test.fn).toHaveBeenCalledWith('foo');
                    done();
                }, 10);
            });
            it('should throw exception from exec', function() {
                var error = {
                    message: 'Some Error',
                    stack: 'stack trace'
                };
                expect(function() {
                    var term = $('<div/>').terminal({
                        echo: function(arg) {
                            throw error;
                        }
                    }, {
                        greetings: false
                    });
                    term.focus().exec('echo foo');
                }).toThrow(error);
            });
            it('should call async rpc methods', function(done) {
                spy(object, 'echo');
                var term = $('<div/>').terminal('/async');
                term.focus().exec('echo foo bar');
                term.insert('foo');
                setTimeout(function() {
                    expect(object.echo).toHaveBeenCalledWith('foo', 'bar');
                    expect(term.get_command()).toEqual('foo');
                    term.destroy().remove();
                    done();
                }, 800);
            });
        });
        describe('autologin', function() {
            var token = 'TOKEN';
            var options = {
                greetings: 'You have been logged in',
                login: function(user, password, callback) {
                    if (user == 'demo' && password == 'demo') {
                        callback(token);
                    } else {
                        callback(null);
                    }
                }
            };
            var term = $('<div/>').appendTo('body').terminal($.noop, options);
            it('should log in', function() {
                spy(options, 'login');
                term.autologin('user', token);
                expect(options.login).not.toHaveBeenCalled();
                expect(term.token()).toEqual(token);
                var last_div = term.find('.terminal-output > div:last-child');
                expect(last_div.text()).toEqual('You have been logged in');
                term.destroy().remove();
            });
        });
        describe('login', function() {
            var term = $('<div/>').appendTo('body').terminal($.noop, {
                name: 'login_method',
                greetings: 'You have been logged in'
            });
            var token = 'TOKEN';
            var login = {
                callback: function(user, password, callback) {
                    if (user === 'foo' && password == 'bar') {
                        callback(token);
                    } else {
                        callback(null);
                    }
                }
            };
            it('should not login', function() {
                spy(login, 'callback');
                term.focus().login(login.callback);
                enter(term, 'foo');
                enter(term, 'foo');
                expect(login.callback).toHaveBeenCalled();
                var last_div = term.find('.terminal-output > div:last-child');
                expect(last_div.text()).toEqual('Wrong password!');
                expect(term.get_prompt()).toEqual('> ');
            });
            it('should ask for login/password on wrong user/password', function() {
                term.login(login.callback, true);
                for(var i=0; i<10; i++) {
                    enter(term, 'foo');
                    expect(term.get_prompt()).toEqual('password: ');
                    enter(term, 'foo');
                    expect(term.get_prompt()).toEqual('login: ');
                }
                term.pop();
            });
            it('should login after first time', function() {
                term.push($.noop, {prompt: '$$ '}).login(login.callback, true);
                enter(term, 'foo');
                enter(term, 'bar');
                expect(term.token(true)).toEqual(token);
                expect(term.get_prompt()).toEqual('$$ ');
                // logout from interpreter, will call login so we need to pop from login
                // and then from intepreter that was pushed
                term.logout(true).pop().pop();
            });
            it('should login after second time', function() {
                term.push($.noop, {prompt: '>>> '}).login(login.callback, true);
                if (term.token(true)) {
                    term.logout(true);
                }
                enter(term, 'foo');
                enter(term, 'foo');
                expect(term.token(true)).toBeFalsy();
                enter(term, 'foo');
                enter(term, 'bar');
                expect(term.token(true)).toEqual(token);
                expect(term.get_prompt()).toEqual('>>> ');
                term.logout(true).pop().pop();
            });
            it('should login to nested interpreter when using login option', function() {
                term.push($.noop, {
                    prompt: '$$$ ',
                    name: 'option',
                    login: login.callback,
                    infiniteLogin: true
                });
                if (term.token(true)) {
                    term.logout(true);
                }
                enter(term, 'foo');
                enter(term, 'foo');
                expect(term.token(true)).toBeFalsy();
                enter(term, 'foo');
                enter(term, 'bar');
                expect(term.token(true)).toEqual(token);
                expect(term.get_prompt()).toEqual('$$$ ');
                term.destroy().remove();
            });
        });
        describe('settings', function() {
            var term = $('<div/>').appendTo('body').terminal();
            it('should return settings even when option is not defined', function() {
                var settings = term.settings();
                expect($.isPlainObject(settings)).toEqual(true);
                term.destroy().remove();
                for (var key in settings) {
                    // name is selector if not defined
                    if (settings.hasOwnProperty(key) && key !== 'name') {
                        expect($.terminal.defaults[key]).toEqual(settings[key]);
                    }
                }
            });
        });
        describe('commands', function() {
            function interpreter(command, term) {}
            it('should return function', function() {
                var term = $('<div/>').appendTo('body').terminal(interpreter);
                expect(term.commands()).toEqual(interpreter);
                term.push('/test');
                expect($.isFunction(term.commands())).toEqual(true);
                term.destroy().remove();
            });
        });
        describe('set_interpreter', function() {
            var term = $('<div/>').appendTo('body').terminal($.noop);
            it('should change intepreter', function() {
                var test = {
                    interpreter: function(command, term) {}
                };
                spy(test, 'interpreter');
                expect(term.commands()).toEqual($.noop);
                term.set_interpreter(test.interpreter);
                expect(term.commands()).toEqual(test.interpreter);
                term.exec('foo');
                expect(test.interpreter).toHaveBeenCalledWith('foo', term);
            });
            it('should create async JSON-RPC with login', function(done) {
                spy(object, 'echo');
                spy(object, 'login');
                term.set_prompt('$ ');
                term.set_interpreter('/async', true).focus();
                if (term.token(true)) {
                    term.logout(true);
                }
                enter(term, 'demo');
                enter(term, 'demo');
                setTimeout(function() {
                    expect(term.get_prompt()).toEqual('$ ');
                    expect(object.login).toHaveBeenCalledWith('demo', 'demo');
                    enter(term, 'echo foo');
                    setTimeout(function() {
                        expect(object.echo).toHaveBeenCalledWith(token, 'foo');
                        term.destroy().remove();
                        done();
                    }, 500);
                }, 500);
            }, 5000);
        });
        describe('greetings', function() {
            it('should show greetings', function(done) {
                var greetings = {
                    fn: function(callback) {
                        setTimeout(function() {
                            callback(greetings.string);
                        }, 200);
                    },
                    string: 'Hello World!'
                };
                spy(greetings, 'fn');
                var term = $('<div/>').terminal($.noop, {
                    greetings: greetings.string
                });
                term.clear().greetings();
                var last_div = term.find('.terminal-output > div:last-child');
                expect(last_div.text()).toEqual(nbsp(greetings.string));
                term.settings().greetings = greetings.fn;
                term.clear().greetings();
                expect(greetings.fn).toHaveBeenCalled();
                setTimeout(function() {
                    last_div = term.find('.terminal-output > div:last-child');
                    expect(last_div.text()).toEqual(nbsp(greetings.string));
                    term.settings().greetings = undefined;
                    term.clear().greetings();
                    last_div = term.find('.terminal-output > div:last-child');
                    var text = last_div.find('div').map(function() {
                        return $(this).text();
                    }).get().join('\n');
                    expect(text).toEqual(nbsp(term.signature()));
                    term.destroy().remove();
                    done();
                }, 400);
            });
        });
        describe('pause/paused/resume', function() {
            var term = $('<div/>').appendTo('body').terminal();
            it('should return true on init', function() {
                expect(term.paused()).toBeFalsy();
            });
            it('should return true when paused', function() {
                term.pause();
                expect(term.paused()).toBeTruthy();
            });
            it('should return false when called resume', function() {
                term.resume();
                expect(term.paused()).toBeFalsy();
                term.destroy().remove();
            });
        });
        describe('cols/rows', function() {
            var numChars = 100;
            var numRows = 25;
            var term = $('<div/>').appendTo('body').terminal($.noop, {
                numChars: numChars,
                numRows: numRows
            });
            it('should return number of cols', function() {
                expect(term.cols()).toEqual(numChars);
            });
            it('should return number of rows', function() {
                expect(term.rows()).toEqual(numRows);
                term.destroy().remove();
            });
        });
        describe('history', function() {
            var term = $('<div/>').appendTo('body').terminal($.noop, {
                name: 'history'
            });
            var history;
            it('should return history object', function() {
                history = term.history();
                expect(history).toEqual(jasmine.any(Object));
            });
            it('should have entered commands', function() {
                history.clear();
                term.focus();
                enter(term, 'foo');
                enter(term, 'bar');
                enter(term, 'baz');
                expect(history.data()).toEqual(['foo', 'bar', 'baz']);
                term.destroy().remove();
            });
        });
        describe('history_state', function() {
            var term = $('<div/>').appendTo('body').terminal($.noop);
            term.echo('history_state');
            it('should not record commands', function() {
                var hash = decodeURIComponent(location.hash);
                term.focus();
                enter(term, 'foo');
                expect(decodeURIComponent(location.hash)).toEqual(hash);
            });
            it('should start recording commands', function(done) {
                location.hash = '';
                term.clear_history_state().clear();
                var id = term.id();
                window.id = id;
                var hash = '#[['+id+',1,"foo"],['+id+',2,"bar"]]';
                term.history_state(true);
                // historyState option is turn on after 1 miliseconds to prevent
                // command, that's enabled the history, to be included in hash
                setTimeout(function() {
                    term.focus();
                    //delete window.commands;
                    enter(term, 'foo');
                    enter(term, 'bar');
                    setTimeout(function() {
                        expect(term.get_output()).toEqual('> foo\n> bar');
                        expect(decodeURIComponent(location.hash)).toEqual(hash);
                        term.destroy().remove();
                        done();
                    }, 0);
                }, 400);
            });
        });
        describe('next', function() {
            var term1 = $('<div/>').terminal();
            var term2 = $('<div/>').terminal();
            it('should swith to next terminal', function() {
                term1.focus();
                term1.next();
                expect($.terminal.active().id()).toBe(term2.id());
                term1.destroy();
                term2.destroy();
            });
        });
        describe('focus', function() {
            var term1 = $('<div/>').terminal();
            var term2 = $('<div/>').terminal();
            it('should focus on first terminal', function() {
                term1.focus();
                expect($.terminal.active().id()).toBe(term1.id());
            });
            it('should focus on second terminal', function() {
                term1.focus(false);
                expect($.terminal.active().id()).toBe(term2.id());
                term1.destroy();
                term2.destroy();
            });
        });
        describe('freeze/frozen', function() {
            var term = $('<div/>').appendTo('body').terminal();
            it('should accept input', function() {
                term.focus();
                enter_text('foo');
                expect(term.frozen()).toBeFalsy();
                expect(term.get_command()).toEqual('foo');
            });
            it('should be frozen', function() {
                term.set_command('');
                term.freeze(true);
                expect(term.frozen()).toBeTruthy();
                enter_text('bar');
                expect(term.get_command()).toEqual('');
            });
            it('should not enable terminal', function() {
                expect(term.enabled()).toBeFalsy();
                term.enable();
                expect(term.enabled()).toBeFalsy();
            });
            it('should accpet input again', function() {
                term.freeze(false);
                expect(term.frozen()).toBeFalsy();
                enter_text('baz');
                expect(term.get_command()).toEqual('baz');
                term.destroy();
            });
        });
        describe('enable/disable/enabled', function() {
            var term = $('<div/>').appendTo('body').terminal();
            it('terminal should be enabled', function() {
                term.focus();
                expect(term.enabled()).toBeTruthy();
            });
            it('should disable terminal', function() {
                term.disable();
                expect(term.enabled()).toBeFalsy();
            });
            it('should disable command line plugin', function() {
                expect(term.cmd().isenabled()).toBeFalsy();
            });
            it('should enable terminal', function() {
                term.enable();
                expect(term.enabled()).toBeTruthy();
            });
            it('should enable command line plugin', function() {
                expect(term.cmd().isenabled()).toBeTruthy();
                term.destroy().remove();
            });
        });
        describe('signature', function() {
            var term = $('<div/>').terminal($.noop, {
                numChars: 14
            });
            function max_length() {
                var lines = term.signature().split('\n');
                return Math.max.apply(null, lines.map(function(line) {
                    return line.length;
                }));
            }
            it('should return space', function() {
                expect(term.signature()).toEqual('');
            });
            it('should return proper max length of signature', function() {
                var numbers = {20: 20, 36: 30, 60: 52, 70: 64, 100: 75};
                Object.keys(numbers).forEach(function(numChars) {
                    var length = numbers[numChars];
                    term.option('numChars', numChars);
                    expect(max_length()).toEqual(length);
                });
                term.destroy();
            });
        });
        describe('version', function() {
            var term = $('<div/>').terminal();
            it('should return version', function() {
                expect(term.version()).toEqual($.terminal.version);
                term.destroy();
            });
        });
        // missing methods after version
        describe('flush', function() {
            var term = $('<div/>').terminal($.noop, {greetings: false});
            it('should echo stuff that was called with flush false', function() {
                term.echo('foo', {flush: false});
                term.echo('bar', {flush: false});
                term.echo('baz', {flush: false});
                term.flush();
                expect(term.find('.terminal-output').text()).toEqual('foobarbaz');
            });
        });
        describe('update', function() {
            var term = $('<div/>').terminal($.noop, {greetings: false});
            it('should update terminal output', function() {
                term.echo('Hello');
                term.update(0, 'Hello, World!');
                expect(term.find('.terminal-output').text()).toEqual(nbsp('Hello, World!'));
                term.clear();
                term.echo('Foo');
                term.echo('Bar');
                term.update(-1, 'Baz');
                expect(term.find('.terminal-output').text()).toEqual('FooBaz');
                term.update(-2, 'Lorem');
                term.update(1, 'Ipsum');
                expect(term.find('.terminal-output').text()).toEqual('LoremIpsum');
            });
        });
        describe('last_index', function() {
            var term = $('<div/>').terminal($.noop, {greetings: false});
            it('should return proper index', function() {
                term.echo('Foo');
                term.echo('Bar');
                expect(term.last_index()).toEqual(1);
                function len() {
                    return term.find('.terminal-output div div').length;
                }
                term.echo('Baz');
                term.echo('Quux');
                term.echo('Lorem');
                expect(term.last_index()).toEqual(term.find('.terminal-output div div').length-1);
                var last_line = term.find('.terminal-output > div:eq(' + term.last_index() + ') div');
                expect(last_line.text()).toEqual('Lorem');
            });
        });
        describe('echo', function() {
            var numChars = 100;
            var numRows = 25;
            var term = $('<div/>').appendTo('body').terminal($.noop, {
                greetings: false,
                numChars: numChars,
                numRows: numRows
            });
            function output() {
                return term.find('.terminal-output > div div span').map(function() {
                    return $(this).text().replace(/\xA0/g, ' ');
                }).get();
            }
            it('should echo format urls', function() {
                term.clear();
                term.echo('foo http://jcubic.pl bar http://jcubic.pl/');
                var div = term.find('.terminal-output > div div');
                expect(div.children().length).toEqual(4);
                var link = div.find('a');
                expect(link.length).toEqual(2);
                expect(link.eq(0).attr('target')).toEqual('_blank');
                expect(link.eq(0).attr('href')).toEqual('http://jcubic.pl');
                expect(link.eq(1).attr('href')).toEqual('http://jcubic.pl/');
            });
            it('should echo html', function() {
                var html = [
                    '<img src="http://lorempixel.com/300/200/cats/">',
                    '<p><strong>hello</strong></p>'
                ];
                html.forEach(function(html) {
                    term.echo(html, {raw: true});
                    var line = term.find('.terminal-output > div:eq(' + term.last_index() + ') div');
                    expect(line.html()).toEqual(html);
                });
            });
            it('should call finalize with container div', function() {
                var element;
                var options = {
                    finalize: function(div) {
                        element = div;
                    }
                };
                spy(options, 'finalize');
                term.echo('Lorem Ipsum', options);
                expect(options.finalize).toHaveBeenCalled();
                var line = term.find('.terminal-output > div:eq(' + term.last_index() + ')');
                expect(element.is(line)).toBeTruthy();
            });
            it('should not break words', function() {
                var line = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras ultrices rhoncus hendrerit. Nunc ligula eros, tincidunt posuere tristique quis, iaculis non elit.';
                var lines = ['Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras ultrices rhoncus hendrerit. Nunc', 'ligula eros, tincidunt posuere tristique quis, iaculis non elit.'];
                term.clear().echo(line, {keepWords: true});
                expect(output()).toEqual(lines);
            });
            it('should strip whitespace', function() {
                var words = ['lorem', 'ipsum', 'dolor', 'sit', 'amet'];
                var input = [];
                var i;
                for (i = 0; i < 30; i++) {
                    input.push(words[Math.floor(Math.random() * words.length)]);
                }
                term.clear();
                term.echo(input.join('\t'), {keepWords: true});
                for (i = 80; i < 200; i+=10) {
                    term.option('numChars', i);
                    output().forEach(function(line) {
                        expect(line.match(/^\s+|\s+$/)).toBeFalsy();
                    });
                }
                term.option('numChars', numChars);
            });
            it('should break words if words are longer then the line', function() {
                var line = 'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM';
                var lines = ['MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM', 'MMMMMMMMMMMMMMMMMMMM'];
                term.clear().echo(line);
                expect(output()).toEqual(lines);
                term.clear().echo(line, {keepWords: true});
                expect(output()).toEqual(lines);
            });
            it('should echo both lines if one was not flushed', function() {
                term.clear();
                term.echo('foo', {flush: false});
                term.echo('bar');
                expect(term.find('.terminal-output').text()).toEqual('foobar');
            });
            it('should render multiline JSON array #375', function() {
                var input = JSON.stringify([{"error": "bug"}], null, 2);
                term.clear().echo(input);
                expect(output().join('\n')).toEqual(input);
            });
            describe('extended commands', function() {
                var term = $('<div/>').terminal($.noop, {
                    checkArity: false,
                    invokeMethods: true
                });
                var interpreter;
                beforeEach(function() {
                    interpreter = {
                        foo: function(a, b) {
                        }
                    };
                    spy(interpreter, 'foo');
                    term.push(interpreter);
                });
                afterEach(function() {
                    term.pop();
                });
                it('should invoke command', function() {
                    term.echo('[[ foo ]]]');
                    expect(interpreter.foo).toHaveBeenCalled();
                });
                it('should invoke command with arguments', function() {
                    term.echo('[[ foo "a" /xxx/g ]]]');
                    expect(interpreter.foo).toHaveBeenCalledWith("a", /xxx/g);
                });
                it('should invoke terminal method', function() {
                    spy(term, 'clear');
                    term.echo('[[ terminal::clear() ]]');
                    expect(term.clear).toHaveBeenCalled();
                });
                it('should invoke terminal method with arguments', function() {
                    global.foo = 10;
                    term.echo('[[ terminal::echo("xxx", {finalize: function() { foo = 20; }}) ]]');
                    expect(global.foo).toEqual(20);
                });
                it('should invoke terminal method where arguments have newlines', function() {
                    global.foo = 10;
                    term.echo(`[[ terminal::echo("xxx", {
                                           finalize: function() {
                                               foo = 20;
                                           }
                                      }) ]]`);
                    expect(global.foo).toEqual(20);
                });
                it('should invoke cmd method', function() {
                    term.echo('[[ cmd::prompt(">>>") ]]');
                    expect(term.cmd().prompt()).toEqual('>>>');
                });
            });
        });
        describe('error', function() {
            var term = $('<div/>').terminal($.noop, {
                greetings: false
            });
            var defaults = {
                raw: false,
                formatters: false
            };
            it('should echo error', function() {
                spy(term, 'echo');
                term.error('Message');
                expect(term.echo).toHaveBeenCalledWith('[[;;;error]Message]', defaults);
            });
            it('should escape brakets', function() {
                spy(term, 'echo');
                term.clear().error('[[ Message ]]');
                expect(term.echo).toHaveBeenCalledWith('[[;;;error]&#91;&#91; Message &#93;&#93;]',
                                                       defaults);
                var span = term.find('.terminal-output span');
                expect(span.length).toEqual(1);
                expect(span.hasClass('error')).toBeTruthy();
            });
            it('should handle url', function() {
                term.clear().error('foo http://jcubic.pl bar');
                var children = term.find('.terminal-output div div').children();
                children.filter('span').each(function() {
                    expect($(this).hasClass('error')).toBeTruthy();
                });
                expect(children.filter('a').hasClass('error')).toBeFalsy();
                expect(term.find('.terminal-output a').attr('href')).toEqual('http://jcubic.pl');
            });
            it('should call finialize', function() {
                var options = {
                    finalize: $.noop
                };
                spy(options, 'finalize');
                term.clear().error('Message', options);
                expect(options.finalize).toHaveBeenCalled();
            });
            it('should call echo without raw option', function() {
                spy(term, 'echo');
                var options = {
                    finalize: $.noop,
                    raw: true,
                    flush: true,
                    keepWords: false,
                    formatters: false
                };
                term.clear().error('Message', options);
                options.raw = false;
                expect(term.echo).toHaveBeenCalledWith('[[;;;error]Message]', options);

            });
        });
        describe('exception', function() {
            var error = new Error('Some Message');
            var term;
            var lines = [
                'function foo(a, b) {',
                '    return a + b;',
                '}',
                'foo(10, 20);'
            ];
            AJAXMock('http://localhost/file.js', lines.join('\n'));
            beforeEach(function() {
                term = $('<div/>').terminal($.noop, {
                    greetings: false
                });
                if (error.stack) {
                    var length = Math.max.apply(Math, error.stack.split("\n").map(function(line) {
                        return line.length;
                    }));
                    term.option('numChars', length+1);
                }
            });
            afterEach(function() {
                term.destroy().remove();
            });
            it('should show exception', function() {
                term.exception(error, 'ERROR');
                var message = '[[;;;error]&#91;ERROR&#93;: ';
                if (error.fileName) {
                    message += ']' + error.fileName + '[[;;;error]: ' + error.message;
                } else {
                    message += error.message;
                }
                message += ']';
                window.message = message;
                var re = new RegExp('^' + $.terminal.escape_regex(message));
                window.term = term;
                expect(term.get_output().match(re)).toBeTruthy();
                var div = term.find('.terminal-output > div:eq(0)');
                expect(div.hasClass('exception')).toBeTruthy();
                expect(div.hasClass('message')).toBeTruthy();
                if (error.stack) {
                    var output = term.find('.terminal-output div div').map(function() {
                        return $(this).text().replace(/\xA0/g, ' ');
                    }).get().slice(1);
                    expect(error.stack).toEqual(output.join('\n'));
                    div = term.find('.terminal-output > div:eq(1)');
                    expect(div.hasClass('exception')).toBeTruthy();
                    expect(div.hasClass('stack-trace')).toBeTruthy();
                }
            });
            it('should fetch line from file using AJAX', function(done) {
                var error = {
                    message: 'Some Message',
                    fileName: 'http://localhost/file.js',
                    lineNumber: 2
                };
                term.clear().exception(error, 'foo');
                setTimeout(function() {
                    expect(output(term)).toEqual([
                        '[foo]: http://localhost/file.js: Some Message',
                        '[2]:     return a + b;'
                    ]);
                    done();
                }, 100);
            });
            it('should display stack and fetch line from file', function(done) {
                var error = {
                    message: 'Some Message',
                    filename: 'http://localhost/file.js',
                    stack: [
                        '  foo http://localhost/file.js:2:0',
                        '  main http://localhost/file.js:4:0'
                    ].join('\n')
                };
                function output(div) {
                    return div.find('div').map(function() {
                        return $(this).text();
                    }).get().join('\n');
                }
                term.clear().exception(error, 'foo');
                var stack = term.find('.exception.stack-trace');
                expect(stack.length).toEqual(1);
                expect(output(stack)).toEqual(nbsp(error.stack));
                stack.find('a').eq(1).click();
                setTimeout(function() {
                    expect(stack.next().text()).toEqual(error.filename);
                    var code = lines.map(function(line, i) {
                        return '[' + (i + 1) + ']: ' + line;
                    }).slice(1).join('\n');
                    expect(output(stack.next().next())).toEqual(nbsp(code));
                    done();
                }, 10);
            });
        });
        describe('scroll', function() {
            var term = $('<div/>').terminal($.noop, {
                height: 100,
                numRows: 10
            });
            it('should change scrollTop', function() {
                for (var i = 0; i < 20; i++) {
                    term.echo('text ' + i);
                }
                var pos = term.prop('scrollTop');
                term.scroll(10);
                expect(term.prop('scrollTop')).toEqual(pos + 10);
                term.scroll(-10);
                expect(term.prop('scrollTop')).toEqual(pos);
            });
        });
        describe('logout/token', function() {
            var term;
            beforeEach(function() {
                term = $('<div/>').appendTo('body').terminal($.noop, {
                    name: 'logout',
                    login: function(user, pass, callback) {
                        callback('TOKEN');
                    }
                });
                if (term.token()) {
                    term.logout();
                }
                term.focus();
                enter(term, 'foo');
                enter(term, 'bar');
            });
            afterEach(function() {
                term.destroy().remove();
            });
            function push_interpreter() {
                term.push({}, {
                    prompt: '$ ',
                    login: function(user, pass, callback) {
                        callback(user == '1' && pass == '1' ? 'TOKEN2' : null);
                    }
                });
                if (term.token(true)) {
                    term.logout(true);
                }
            }
            it('should logout from main intepreter', function() {
                expect(term.token()).toEqual('TOKEN');
                expect(term.get_prompt()).toEqual('> ');
                term.logout();
                expect(term.get_prompt()).toEqual('login: ');
            });
            it('should logout from nested interpeter', function() {
                push_interpreter();
                enter(term, '1');
                enter(term, '1');
                expect(term.token(true)).toEqual('TOKEN2');
                term.logout(true);
                expect(term.get_prompt()).toEqual('login: ');
                expect(term.token(true)).toBeFalsy();
                enter(term, '1');
                enter(term, '1');
                expect(term.token(true)).toEqual('TOKEN2');
                expect(term.get_prompt()).toEqual('$ ');
            });
            it('should not logout from main intepreter', function() {
                push_interpreter();
                enter(term, '1');
                enter(term, '1');
                expect(term.token(true)).toEqual('TOKEN2');
                term.logout(true);
                expect(term.token()).toEqual('TOKEN');
            });
            it('should throw exception when calling from login', function() {
                term.logout();
                var strings = $.terminal.defaults.strings;
                var error = new Error(sprintf(strings.notWhileLogin, 'logout'));
                expect(function() { term.logout(); }).toThrow(error);
                // in firefox terminal is pausing to fetch the line that trigger exception
                term.option('onResume', function() {
                    term.focus();
                    enter(term, '1');
                    enter(term, '1');
                    push_interpreter();
                    expect(function() { term.logout(true); }).toThrow(error);
                });
            });
            it('should logout from all interpreters', function() {
                push_interpreter();
                enter(term, '2');
                enter(term, '2');
                push_interpreter();
                enter(term, '2');
                enter(term, '2');
                term.logout();
                expect(term.token()).toBeFalsy();
                expect(term.token(true)).toBeFalsy();
                expect(term.get_prompt()).toEqual('login: ');
            });
        });
        describe('get_token', function() {
            var term = $('<div/>').terminal();
            it('should call token', function() {
                spyOn(term, 'token');
                term.get_token();
                expect(term.token).toHaveBeenCalled();
            });
        });
        describe('login_name', function() {
            var term;
            beforeEach(function() {
                term = $('<div/>').terminal({}, {
                    name: 'login_name',
                    login: function(user, pass, callback) {
                        callback('TOKEN');
                    }
                });
                if (!term.token()) {
                    term.focus();
                    enter(term, 'foo');
                    enter(term, 'bar');
                }
            });
            afterEach(function() {
                term.destroy();
            });
            it('should return main login name', function() {
                expect(term.login_name()).toEqual('foo');
            });
            function push_interpeter() {
                term.push({}, {
                    name: 'nested',
                    login: function(user, pass, callback) {
                        callback('TOKEN2');
                    }
                });
                if (!term.token(true)) {
                    enter(term, 'bar');
                    enter(term, 'bar');
                }
            }
            it('should return main login name for nested interpreter', function() {
                push_interpeter();
                expect(term.login_name()).toEqual('foo');
            });
            it('should return nested interpreter name', function() {
                push_interpeter();
                expect(term.login_name(true)).toEqual('bar');
            });
        });
        describe('name', function() {
            var term;
            beforeEach(function() {
                term = $('<div/>').terminal({}, {
                    name: 'test_name'
                });
            });
            it('should return terminal name', function() {
                expect(term.name()).toEqual('test_name');
            });
            it('should return nested intepreter name', function() {
                term.push({}, {
                    name: 'other_name'
                });
                expect(term.name()).toEqual('other_name');
            });
        });
        describe('prefix_name', function() {
            it('should return terminal id if terminal have no name', function() {
                var term = $('<div/>').terminal();
                expect(term.prefix_name()).toEqual(String(term.id()));
                expect(term.prefix_name(true)).toEqual(String(term.id()));
            });
            it('should return name and terminal id for main interpreter', function() {
                var term = $('<div/>').terminal({}, {
                    name: 'test'
                });
                expect(term.prefix_name()).toEqual('test_' + term.id());
                expect(term.prefix_name(true)).toEqual('test_' + term.id());
            });
            it('should return main name for nested interpreter', function() {
                var term = $('<div/>').terminal({}, {
                    name: 'test'
                });
                term.push({}, {name: 'test'});
                expect(term.prefix_name()).toEqual('test_' + term.id());
            });
            it('should return name for nested intepters', function() {
                var term = $('<div/>').terminal({}, {
                    name: 'test'
                });
                var names = ['foo', 'bar', 'baz'];
                names.forEach(function(name) {
                    term.push({}, {name: name});
                });
                expect(term.prefix_name(true)).toEqual('test_' + term.id() + '_' + names.join('_'));
            });
            it('should return name for nested interpreter without names', function() {
                var term = $('<div/>').terminal({}, {
                    name: 'test'
                });
                for(var i=0; i<3; ++i) {
                    term.push({});
                }
                expect(term.prefix_name(true)).toEqual('test_' + term.id() + '___');
            });
        });
        describe('read', function() {
            var term;
            var test;
            beforeEach(function() {
                term = $('<div/>').terminal();
            });
            afterEach(function() {
                term.destroy();
            });
            it('should call have prompt', function() {
                term.read('text: ');
                expect(term.get_prompt()).toEqual('text: ');
            });
            it('should return promise that get resolved', function() {
                var test = {
                    callback: function() {}
                };
                spyOn(test, 'callback');
                var promise = term.read('foo: ', test.callback);
                promise.then(test.callback);
                var text = 'lorem ipsum';
                enter(term, text);
                expect(test.callback).toHaveBeenCalledWith(text);
            });
            it('should call call function with text', function() {
                var test = {
                    callback: function() {}
                };
                spyOn(test, 'callback');
                term.read('foo: ', test.callback);
                var text = 'lorem ipsum';
                enter(term, text);
                expect(test.callback).toHaveBeenCalledWith(text);
            });
            it('should cancel', function() {
                var test = {
                    success: function() {},
                    cancel: function() {}
                };
                spyOn(test, 'success');
                spyOn(test, 'cancel');
                term.read('foo: ', test.success, test.cancel);
                shortcut(true, false, false, 'd');
                expect(test.success).not.toHaveBeenCalled();
                expect(test.cancel).toHaveBeenCalled();
            });
        });
        describe('push', function() {
            var term;
            beforeEach(function() {
                term = $('<div/>').terminal({
                    name: function(name) {
                        this.push({}, {
                            name: name
                        });
                    },
                    no_name: function() {
                        this.push({});
                    }
                });
                term.focus();
            });
            afterEach(function() {
                term.destroy().remove();
            });
            it('should push new interpreter', function() {
                term.push({});
                expect(term.level()).toEqual(2);
            });
            it('should create name from previous command', function() {
                enter(term, 'name foo');
                expect(term.name()).toEqual('foo');
            });
            it('should create prompt from previous command', function() {
                enter(term, 'no_name');
                expect(term.get_prompt()).toEqual('no_name ');
            });
            it('should create completion', function() {
                term.push({
                    foo: function() {},
                    bar: function() {},
                    baz: function() {}
                }, {
                    name: 'push_completion',
                    completion: true
                });
                var top = term.export_view().interpreters.top();
                expect(top.name).toEqual('push_completion');
                expect(top.completion).toEqual(['foo', 'bar', 'baz']);
            });
            it('should create login', function() {
                term.push({}, {
                    login: function() {}
                });
                expect(term.get_prompt()).toEqual('login: ');
            });
            it('should create login for JSON-RPC', function() {
                spyOn(object, 'login');
                term.push('/test', {
                    login: true,
                    name: 'push_login_rpc'
                });
                if (term.token(true)) {
                    term.logout(true);
                }
                expect(term.get_prompt()).toEqual('login: ');
                enter(term, 'demo');
                enter(term, 'demo');
                expect(object.login).toHaveBeenCalled();
            });
            it('should keep asking for login when infiniteLogin option is set to true', function() {
                var token = 'infiniteLogin_TOKEN';
                var prompt = '>>> ';
                term.push({}, {
                    login: function(user, pass, callback) {
                        callback(user == 'foo' && pass == 'bar' ? token : null);
                    },
                    infiniteLogin: true,
                    name: 'infiniteLogin',
                    prompt: prompt
                });
                if (term.token(true)) {
                    term.logout(true);
                }
                enter(term, 'baz');
                enter(term, 'baz');
                var strings = $.terminal.defaults.strings;
                var error = nbsp(strings.wrongPasswordTryAgain);
                expect(term.find('.terminal-output > div:last-child').text()).toEqual(error);
                expect(term.get_prompt()).toEqual('login: ');
                enter(term, 'foo');
                enter(term, 'bar');
                expect(term.get_token(true)).toEqual(token);
                expect(term.get_prompt()).toEqual(prompt);
            });
        });
        describe('pop', function() {
            describe('with login', function() {
                var token = 'TOKEN';
                var term;
                var options;
                beforeEach(function() {
                    options = {
                        name: 'pop',
                        onExit: function() {},
                        login: function(user, password, callback) {
                            callback(token);
                        },
                        onPop: function() {}
                    };
                    spy(options, 'onExit');
                    spy(options, 'onPop');
                    term = $('<div/>').terminal({}, options);
                    if (term.token()) {
                        term.logout();
                    }
                    enter(term, 'foo');
                    enter(term, 'bar');
                    ['one', 'two', 'three', 'four'].forEach(function(name, index) {
                        term.push($.noop, {
                            name: name,
                            prompt: (index+1) + '> '
                        });
                    });
                });
                afterEach(function() {
                    reset(options.onExit);
                    reset(options.onPop);
                    term.destroy();
                });
                it('should return terminal object', function() {
                    expect(term.pop()).toEqual(term);
                });
                it('should pop one interpreter', function() {
                    term.pop();
                    expect(term.name()).toEqual('three');
                    expect(term.get_prompt()).toEqual('3> ');
                });
                it('should pop all interpreters', function() {
                    while(term.level() > 1) {
                        term.pop();
                    }
                    expect(term.name()).toEqual('pop');
                    expect(term.get_prompt()).toEqual('> ');
                });
                it('should logout from main intepreter', function() {
                    while(term.level() > 1) {
                        term.pop();
                    }
                    term.pop();
                    expect(term.get_prompt()).toEqual('login: ');
                });
                it('should call callbacks', function() {
                    expect(count(options.onPop)).toBe(0);
                    while(term.level() > 1) {
                        term.pop();
                    }
                    term.pop();
                    expect(options.onExit).toHaveBeenCalled();
                    expect(options.onExit).toHaveBeenCalled();
                    expect(count(options.onExit)).toBe(1);
                    expect(count(options.onPop)).toBe(5);
                });
            });
        });
        describe('option', function() {
            var options = {
                prompt: '$ ',
                onInit: function() {
                },
                width: 400,
                onPop: function() {
                }
            };
            var term = $('<div/>').terminal($.noop, options);
            it('should return option', function() {
                Object.keys(options).forEach(function(name) {
                    expect(term.option(name)).toEqual(options[name]);
                });
            });
            it('should set single value', function() {
                expect(term.option('prompt')).toEqual('$ ');
                term.option('prompt', '>>> ');
                expect(term.option('prompt')).toEqual('>>> ');
            });
            it('should set object', function() {
                var options = {
                    prompt: '# ',
                    onInit: function() {
                        console.log('onInit');
                    }
                };
                term.option(options);
                Object.keys(options).forEach(function(name) {
                    expect(term.option(name)).toEqual(options[name]);
                });
            });
        });
        describe('level', function() {
            var term = $('<div/>').terminal();
            it('should return proper level name', function() {
                expect(term.level()).toEqual(1);
                term.push($.noop);
                term.push($.noop);
                expect(term.level()).toEqual(3);
                term.pop();
                expect(term.level()).toEqual(2);
            });
        });
        describe('reset', function() {
            var interpreter = function(command) {
            };
            var greetings = 'Hello';
            var term = $('<div/>').terminal(interpreter, {
                prompt: '1> ',
                greetings: greetings
            });
            it('should reset all interpreters', function() {
                term.push($.noop, {prompt: '2> '});
                term.push($.noop, {prompt: '3> '});
                term.push($.noop, {prompt: '4> '});
                expect(term.level()).toEqual(4);
                term.echo('foo');
                term.reset();
                expect(term.level()).toEqual(1);
                expect(term.get_prompt()).toEqual('1> ');
                expect(term.get_output()).toEqual(greetings);
            });
        });
        describe('purge', function() {
            var token = 'purge_TOKEN';
            var password = 'password';
            var username = 'some-user';
            var term;
            beforeEach(function() {
                term = $('<div/>').terminal($.noop, {
                    login: function(user, pass, callback) {
                        callback(token);
                    },
                    name: 'purge'
                });
                if (term.token()) {
                    term.logout();
                }
                enter(term, username);
                enter(term, password);
            });
            afterEach(function() {
                term.purge().destroy();
            });
            it('should remove login and token', function() {
                expect(term.login_name()).toEqual(username);
                expect(term.token()).toEqual(token);
                term.purge();
                expect(term.login_name()).toBeFalsy();
                expect(term.token()).toBeFalsy();
            });
            it('should remove commands history', function() {
                var commands = ['echo "foo"', 'sleep', 'pause'];
                commands.forEach(function(command) {
                    enter(term, command);
                });
                var history = term.history();
                expect(history.data()).toEqual(commands);
                term.purge();
                expect(history.data()).toEqual([]);
            });
        });
        describe('destroy', function() {
            var greetings = 'hello world!';
            var element = '<span>span</span>';
            var term;
            var height = 400;
            var width = 200;
            beforeEach(function() {
                term = $('<div class="foo">' + element + '</div>').terminal($.noop, {
                    greetings: greetings,
                    width: width,
                    height: height
                });
            });
            it('should remove terminal class', function() {
                expect(term.hasClass('terminal')).toBeTruthy();
                term.destroy();
                expect(term.hasClass('terminal')).toBeFalsy();
                expect(term.hasClass('foo')).toBeTruthy();
            });
            it('should remove command line and output', function() {
                term.destroy();
                expect(term.find('.terminal-output').length).toEqual(0);
                expect(term.find('.cmd').length).toEqual(0);
            });
            it('should leave span intact', function() {
                term.destroy();
                expect(term.html()).toEqual(element);
            });
            it('should throw when calling method after destroy', function() {
                term.destroy();
                expect(function() { term.login(); }).toThrow(
                    new $.terminal.Exception($.terminal.defaults.strings.defunctTerminal)
                );
            });
        });
        describe('set_token', function() {
            var token = 'set_token';
            var term = $('<div/>').terminal($.noop, {
                login: function(user, password, callback) {
                    callback(token);
                }
            });
            if (term.token()) {
                term.logout();
            }
            it('should set token', function() {
                expect(term.token()).toBeFalsy();
                enter(term, 'user');
                enter(term, 'password');
                expect(term.token()).toEqual(token);
                var newToken = 'set_token_new';
                term.set_token(newToken);
                expect(term.token()).toEqual(newToken);
            });
        });
        describe('before_cursor', function() {
            var term = $('<div/>').terminal();
            var cmd = term.cmd();
            it('should return word before cursor', function() {
                var commands = [
                    ['foo bar baz', 'baz'],
                    ['foo "bar baz', '"bar baz'],
                    ["foo \"bar\" 'baz quux", "'baz quux"],
                    ['foo "foo \\" bar', '"foo \\" bar']
                ];
                commands.forEach(function(spec) {
                    term.set_command(spec[0]);
                    expect(term.before_cursor(true)).toEqual(spec[1]);
                });
            });
            it('should return word before cursor when cursor not at the end', function() {
                var commands = [
                    ['foo bar baz', 'b'],
                    ['foo "bar baz', '"bar b'],
                    ["foo \"bar\" 'baz quux", "'baz qu"],
                    ['foo "foo \\" bar', '"foo \\" b']
                ];
                commands.forEach(function(spec) {
                    term.set_command(spec[0]);
                    cmd.position(-2, true);
                    expect(term.before_cursor(true)).toEqual(spec[1]);
                });
            });
            it('should return text before cursor', function() {
                var command = 'foo bar baz';
                term.set_command(command);
                expect(term.before_cursor()).toEqual(command);
                cmd.position(-2, true);
                expect(term.before_cursor()).toEqual('foo bar b');
            });
        });
        describe('set_command/get_command', function() {
            var term = $('<div/>').terminal($.noop, {
                prompt: 'foo> '
            });
            it('should return init prompt', function() {
                expect(term.get_prompt()).toEqual('foo> ');
            });
            it('should return new prompt', function() {
                var prompt = 'bar> ';
                term.set_prompt(prompt);
                expect(term.get_prompt()).toEqual(prompt);
            });
        });
        describe('complete', function() {
            var term = $('<div/>').terminal();
            function test(specs, options) {
                specs.forEach(function(spec) {
                    term.focus();
                    // complete method resets tab count when you press non-tab
                    shortcut(false, false, false, 37, 'arrowleft');
                    term.set_command(spec[0]);
                    expect(term.complete(spec[1], options)).toBe(spec[2]);
                    expect(term.get_command()).toEqual(spec[3]);
                });
            }
            it('should complete whole word', function() {
                test([
                    ['f', ['foo', 'bar'], true, 'foo'],
                    ['b', ['foo', 'bar'], true, 'bar'],
                    ['F', ['FOO', 'BAR'], true, 'FOO'],
                    ['f', ['FOO', 'BAR'], undefined, 'f']
                ]);
            });
            it('should complete common string', function() {
                test([
                    ['f', ['foo-bar', 'foo-baz'], true, 'foo-ba'],
                    ['f', ['fooBar', 'fooBaz'], true, 'fooBa']
                ]);
            });
            it("should complete word that don't match case", function() {
                test([
                    ['f', ['FOO-BAZ', 'FOO-BAR'], true, 'foo-ba'],
                    ['f', ['FooBar', 'FooBaz'], true, 'fooBa'],
                    ['Foo', ['FOO-BAZ', 'FOO-BAR'], true, 'Foo-BA'],
                    ['FOO', ['FOO-BAZ', 'FOO-BAR'], true, 'FOO-BA'],
                ], {
                    caseSensitive: false
                });
            });
            it('should complete whole line', function() {
                var completion = ['lorem ipsum dolor sit amet', 'foo bar baz'];
                test([
                    ['"lorem ipsum', completion, true, '"lorem ipsum dolor sit amet"'],
                    ['lorem\\ ipsum', completion, true, 'lorem\\ ipsum\\ dolor\\ sit\\ amet'],
                ]);
                test([
                    ['lorem', completion, true, completion[0]],
                    ['lorem ipsum', completion, true, completion[0]]
                ], {
                    word: false,
                    escape: false
                });
            });
            it('should echo all matched strings', function() {
                var completion = ['foo-bar', 'foo-baz', 'foo-quux'];
                term.clear().focus();
                term.set_command('f');
                term.complete(completion, {echo: true});
                term.complete(completion, {echo: true});
                var re = new RegExp('^>\\sfoo-\\n' + completion.join('\\s+') + '$');
                var output = term.find('.terminal-output > div').map(function() {
                    return $(this).text();
                }).get().join('\n');
                expect(output.match(re)).toBeTruthy();
            });
        });
        describe('get_output', function() {
            var term = $('<div/>').terminal($.noop, {greetings: false});
            it('should return string out of all lines', function() {
                term.echo('foo');
                term.echo('bar');
                term.focus().set_command('quux');
                enter_key();
                expect(term.get_output()).toEqual('foo\nbar\n> quux');
            });
        });
        describe('update', function() {
            var term = $('<div/>').terminal();
            function last_line() {
                return last_div().find('div');
            }
            function last_div() {
                return term.find('.terminal-output > div:last-child');
            }
            it('should update last line', function() {
                term.echo('foo');
                expect(last_line().text()).toEqual('foo');
                term.update(-1, 'bar');
                expect(last_line().text()).toEqual('bar');
            });
            it('should remove last line', function() {
                var index = term.last_index();
                term.echo('quux');
                expect(term.last_index()).toEqual(index + 1);
                term.update(index + 1, null);
                expect(term.last_index()).toEqual(index);
            });
            it('should call finalize', function() {
                var options = {
                    finalize: function() {}
                };
                spy(options, 'finalize');
                term.update(-1, 'baz', options);
                expect(options.finalize).toHaveBeenCalled();
            });
        });
        describe('keymap', function() {
            var term;
            var test;
            beforeEach(function() {
                test = {
                    empty: function() {},
                    original: function(e, original) {
                        original();
                    }
                };
                spy(test, 'empty');
                spy(test, 'original');
                term = $('<div/>').terminal($.noop, {
                    keymap: {
                        'CTRL+C': test.original,
                        'CTRL+D': test.original
                    }
                });
                term.focus();
            });
            it('should call init keymap', function() {
                term.clear().insert('foo');
                shortcut(true, false, false, 'c');
                expect(test.original).toHaveBeenCalled();
                expect(last_div(term).text().match(/foo\^C/)).toBeTruthy();
                term.pause();
                shortcut(true, false, false, 'D');
                expect(term.paused()).toBeFalsy();
            });
            it('should set and call keymap shortcut', function() {
                term.keymap('CTRL+T', test.empty);
                shortcut(true, false, false, 84, 't');
                expect(test.empty).toHaveBeenCalled();
            });
            it('should create keymap from object', function() {
                term.keymap({
                    'CTRL+T': test.empty
                });
                shortcut(true, false, false, 84, 't');
                expect(test.empty).toHaveBeenCalled();
            });
            it('should overwrite terminal keymap', function() {
                term.echo('foo');
                shortcut(true, false, false, 76, 'l');
                expect(term.get_output()).toEqual('');
                term.echo('bar');
                term.keymap('CTRL+L', test.empty);
                shortcut(true, false, false, 76, 'l');
                expect(term.get_output()).not.toEqual('');
            });
            it('should call default terminal keymap', function() {
                term.echo('foo');
                term.keymap('CTRL+L', test.original);
                shortcut(true, false, false, 76, 'l');
                expect(term.get_output()).toEqual('');
            });
            it('should overwrite cmd keymap', function() {
                term.set_command('foo');
                term.keymap('ENTER', test.empty);
                enter_key();
                expect(term.get_command()).toEqual('foo');
            });
            it('should call default cmd keymap', function() {
                term.set_command('foo');
                term.keymap({
                    'ENTER': test.original
                });
                enter_key();
                expect(term.get_command()).toEqual('');
            });
            it('should return keymap', function() {
                var fn = function() { };
                var keys = Object.keys(term.keymap());
                expect(term.keymap('CTRL+S')).toBeFalsy();
                term.keymap('CTRL+S', fn);
                expect(term.keymap('CTRL+S')).toBeTruthy();
                expect(term.keymap()['CTRL+S']).toBeTruthy();
                expect(Object.keys(term.keymap())).toEqual(keys.concat(['CTRL+S']));
            });
        });
        describe('invoke_key', function() {
            var term = $('<div/>').terminal();
            expect(term.find('.terminal-output').html()).toBeTruthy();
            term.invoke_key('CTRL+L');
            expect(term.find('.terminal-output').html()).toBeFalsy();
        });
    });
});
