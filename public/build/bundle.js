
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            // @ts-ignore
            callbacks.slice().forEach(fn => fn.call(this, event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.46.4' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\components\Header.svelte generated by Svelte v3.46.4 */

    const file$5 = "src\\components\\Header.svelte";

    function create_fragment$5(ctx) {
    	let header;
    	let img0;
    	let img0_src_value;
    	let t;
    	let img1;
    	let img1_src_value;

    	const block = {
    		c: function create() {
    			header = element("header");
    			img0 = element("img");
    			t = space();
    			img1 = element("img");
    			attr_dev(img0, "class", "source-flag svelte-7aih7w");
    			if (!src_url_equal(img0.src, img0_src_value = "/img/gb.svg")) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "Flag of UKGBNI");
    			add_location(img0, file$5, 1, 4, 14);
    			attr_dev(img1, "class", "target-flag svelte-7aih7w");
    			if (!src_url_equal(img1.src, img1_src_value = "/img/tr.svg")) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "Flag of Turkey");
    			add_location(img1, file$5, 2, 4, 84);
    			attr_dev(header, "class", "svelte-7aih7w");
    			add_location(header, file$5, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, img0);
    			append_dev(header, t);
    			append_dev(header, img1);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Header', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src\shared\Card.svelte generated by Svelte v3.46.4 */

    const file$4 = "src\\shared\\Card.svelte";

    function create_fragment$4(ctx) {
    	let div;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[1].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			attr_dev(div, "class", "card svelte-nmnyij");
    			add_location(div, file$4, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[0],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[0])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[0], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Card', slots, ['default']);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Card> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('$$scope' in $$props) $$invalidate(0, $$scope = $$props.$$scope);
    	};

    	return [$$scope, slots];
    }

    class Card extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Card",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src\components\TargetSentence.svelte generated by Svelte v3.46.4 */
    const file$3 = "src\\components\\TargetSentence.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[16] = list[i];
    	return child_ctx;
    }

    // (97:4) {:else}
    function create_else_block$1(ctx) {
    	let span;
    	let t_value = /*span*/ ctx[16] + "";
    	let t;

    	const block = {
    		c: function create() {
    			span = element("span");
    			t = text(t_value);
    			add_location(span, file$3, 97, 8, 2978);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			append_dev(span, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*spanList*/ 8 && t_value !== (t_value = /*span*/ ctx[16] + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(97:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (85:4) {#if span.toLowerCase() === word.toLowerCase()}
    function create_if_block$2(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "class", "text-input svelte-k1f6vd");
    			attr_dev(input, "type", "text");
    			attr_dev(input, "autocomplete", "off");
    			attr_dev(input, "autocorrect", "off");
    			attr_dev(input, "spellcheck", "false");
    			attr_dev(input, "autocapitalize", "off");
    			attr_dev(input, "placeholder", /*hint*/ ctx[2]);
    			input.autofocus = true;
    			add_location(input, file$3, 85, 8, 2622);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*answer*/ ctx[1]);
    			input.focus();

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[9]),
    					listen_dev(input, "keypress", /*handleSubmit*/ ctx[4], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*hint*/ 4) {
    				attr_dev(input, "placeholder", /*hint*/ ctx[2]);
    			}

    			if (dirty & /*answer*/ 2 && input.value !== /*answer*/ ctx[1]) {
    				set_input_value(input, /*answer*/ ctx[1]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(85:4) {#if span.toLowerCase() === word.toLowerCase()}",
    		ctx
    	});

    	return block;
    }

    // (84:0) {#each spanList as span}
    function create_each_block$1(ctx) {
    	let show_if;
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (dirty & /*spanList, word*/ 9) show_if = null;
    		if (show_if == null) show_if = !!(/*span*/ ctx[16].toLowerCase() === /*word*/ ctx[0].toLowerCase());
    		if (show_if) return create_if_block$2;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx, -1);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx, dirty)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(84:0) {#each spanList as span}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let each_1_anchor;
    	let each_value = /*spanList*/ ctx[3];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*hint, answer, handleSubmit, spanList, word*/ 31) {
    				each_value = /*spanList*/ ctx[3];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const re = /[\w'ÇĞIİİÖŞÜçğıi̇öşü]+|\s+|[^\s\w]+/gu;

    function instance$3($$self, $$props, $$invalidate) {
    	let word;
    	let sentence;
    	let id;
    	let spanList;
    	let textWidth;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('TargetSentence', slots, []);
    	const dispatch = createEventDispatcher();
    	let { wordObj } = $$props;
    	let answer = "";
    	let solved = false;
    	let hint = "";
    	let hintStage = 0;

    	// refactor
    	function handleSubmit(event) {
    		const icon = document.querySelector(".correct-tick");
    		const inputs = document.querySelectorAll(".text-input");

    		if (event.key === 'Enter') {
    			if (word.toLowerCase() === answer.toLowerCase()) {
    				inputs.forEach(input => {
    					icon.innerHTML = "&#x2714;";
    					icon.style.color = "green";
    					input.style.color = "green";
    					input.style.backgroundColor = "white";
    				});

    				solved = true;
    				$$invalidate(2, hint = "");
    				hintStage = 0;

    				setTimeout(
    					() => {
    						document.querySelector(".correct-tick").innerHTML = "";
    						document.querySelector(".text-input").style.backgroundColor = "#e9ebf1";
    						dispatch('sucess');
    					},
    					1000
    				);
    			} else {
    				inputs.forEach(input => {
    					icon.innerHTML = "&#x2716;";
    					icon.style.color = "darkred";
    					input.style.color = "darkred";
    					input.style.backgroundColor = "white";
    				});

    				setTimeout(
    					() => {
    						document.querySelector(".correct-tick").innerHTML = "";
    						document.querySelector(".text-input").style.color = "#333";
    						document.querySelector(".text-input").style.backgroundColor = "#e9ebf1";
    						$$invalidate(2, hint = word.slice(0, ++hintStage));
    						$$invalidate(1, answer = "");
    					},
    					250
    				);
    			}
    		}
    	}

    	const canvas = document.createElement('canvas');
    	const ctx = canvas.getContext("2d");
    	ctx.font = "25px Helvetica";

    	function handleLoad() {
    		const inputs = document.querySelectorAll(".text-input");

    		inputs.forEach(input => {
    			input.style.width = textWidth + "px";
    		});
    	}

    	afterUpdate(handleLoad);
    	const writable_props = ['wordObj'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<TargetSentence> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		answer = this.value;
    		(($$invalidate(1, answer), $$invalidate(8, id)), $$invalidate(5, wordObj));
    	}

    	$$self.$$set = $$props => {
    		if ('wordObj' in $$props) $$invalidate(5, wordObj = $$props.wordObj);
    	};

    	$$self.$capture_state = () => ({
    		afterUpdate,
    		createEventDispatcher,
    		dispatch,
    		wordObj,
    		answer,
    		solved,
    		hint,
    		hintStage,
    		re,
    		handleSubmit,
    		canvas,
    		ctx,
    		handleLoad,
    		textWidth,
    		word,
    		sentence,
    		spanList,
    		id
    	});

    	$$self.$inject_state = $$props => {
    		if ('wordObj' in $$props) $$invalidate(5, wordObj = $$props.wordObj);
    		if ('answer' in $$props) $$invalidate(1, answer = $$props.answer);
    		if ('solved' in $$props) solved = $$props.solved;
    		if ('hint' in $$props) $$invalidate(2, hint = $$props.hint);
    		if ('hintStage' in $$props) hintStage = $$props.hintStage;
    		if ('textWidth' in $$props) textWidth = $$props.textWidth;
    		if ('word' in $$props) $$invalidate(0, word = $$props.word);
    		if ('sentence' in $$props) $$invalidate(7, sentence = $$props.sentence);
    		if ('spanList' in $$props) $$invalidate(3, spanList = $$props.spanList);
    		if ('id' in $$props) $$invalidate(8, id = $$props.id);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*wordObj*/ 32) {
    			$$invalidate(0, word = wordObj.turkish_word);
    		}

    		if ($$self.$$.dirty & /*wordObj*/ 32) {
    			$$invalidate(7, sentence = wordObj.turkish_sentence);
    		}

    		if ($$self.$$.dirty & /*wordObj*/ 32) {
    			$$invalidate(8, id = wordObj.id);
    		}

    		if ($$self.$$.dirty & /*id*/ 256) {
    			// This seems like a hack. Redo properly...
    			{
    				$$invalidate(1, answer = "");
    			}
    		}

    		if ($$self.$$.dirty & /*sentence*/ 128) {
    			$$invalidate(3, spanList = sentence.match(re));
    		}

    		if ($$self.$$.dirty & /*ctx, word*/ 65) {
    			textWidth = 1 + Math.ceil(ctx.measureText(word).width);
    		}
    	};

    	return [
    		word,
    		answer,
    		hint,
    		spanList,
    		handleSubmit,
    		wordObj,
    		ctx,
    		sentence,
    		id,
    		input_input_handler
    	];
    }

    class TargetSentence extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { wordObj: 5 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TargetSentence",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*wordObj*/ ctx[5] === undefined && !('wordObj' in props)) {
    			console.warn("<TargetSentence> was created without expected prop 'wordObj'");
    		}
    	}

    	get wordObj() {
    		throw new Error("<TargetSentence>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set wordObj(value) {
    		throw new Error("<TargetSentence>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\WordDetails.svelte generated by Svelte v3.46.4 */

    const { console: console_1$1 } = globals;
    const file$2 = "src\\components\\WordDetails.svelte";

    // (122:4) {#if wordObj.notes}
    function create_if_block$1(ctx) {
    	let p;
    	let t0;
    	let br;
    	let t1;
    	let t2_value = /*wordObj*/ ctx[1].notes + "";
    	let t2;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t0 = text("notes: ");
    			br = element("br");
    			t1 = space();
    			t2 = text(t2_value);
    			add_location(br, file$2, 122, 28, 3318);
    			attr_dev(p, "class", "notes svelte-ezga6w");
    			add_location(p, file$2, 122, 4, 3294);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t0);
    			append_dev(p, br);
    			append_dev(p, t1);
    			append_dev(p, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*wordObj*/ 2 && t2_value !== (t2_value = /*wordObj*/ ctx[1].notes + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(122:4) {#if wordObj.notes}",
    		ctx
    	});

    	return block;
    }

    // (116:4) <Card>
    function create_default_slot(ctx) {
    	let p0;
    	let targetsentence;
    	let span;
    	let t0;
    	let p1;
    	let t1_value = /*wordObj*/ ctx[1].type + "";
    	let t1;
    	let t2;
    	let hr;
    	let t3;
    	let p2;
    	let t4_value = /*wordObj*/ ctx[1].english_word + "";
    	let t4;
    	let t5;
    	let p3;
    	let t6_value = /*wordObj*/ ctx[1].english_sentence + "";
    	let t6;
    	let t7;
    	let t8;
    	let button0;
    	let t10;
    	let button1;
    	let t12;
    	let p4;
    	let t13;
    	let t14_value = /*wordObj*/ ctx[1].id + "";
    	let t14;
    	let t15;
    	let t16_value = /*wordObj*/ ctx[1].turkish_word + "";
    	let t16;
    	let current;
    	let mounted;
    	let dispose;

    	targetsentence = new TargetSentence({
    			props: { wordObj: /*wordObj*/ ctx[1] },
    			$$inline: true
    		});

    	targetsentence.$on("sucess", /*handleSuccess*/ ctx[2]);
    	let if_block = /*wordObj*/ ctx[1].notes && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			p0 = element("p");
    			create_component(targetsentence.$$.fragment);
    			span = element("span");
    			t0 = space();
    			p1 = element("p");
    			t1 = text(t1_value);
    			t2 = space();
    			hr = element("hr");
    			t3 = space();
    			p2 = element("p");
    			t4 = text(t4_value);
    			t5 = space();
    			p3 = element("p");
    			t6 = text(t6_value);
    			t7 = space();
    			if (if_block) if_block.c();
    			t8 = space();
    			button0 = element("button");
    			button0.textContent = "Previous";
    			t10 = space();
    			button1 = element("button");
    			button1.textContent = "Next";
    			t12 = space();
    			p4 = element("p");
    			t13 = text("debug------");
    			t14 = text(t14_value);
    			t15 = space();
    			t16 = text(t16_value);
    			attr_dev(span, "class", "correct-tick svelte-ezga6w");
    			add_location(span, file$2, 116, 84, 3051);
    			attr_dev(p0, "class", "target-sentence svelte-ezga6w");
    			add_location(p0, file$2, 116, 4, 2971);
    			attr_dev(p1, "class", "word-type svelte-ezga6w");
    			add_location(p1, file$2, 117, 4, 3095);
    			add_location(hr, file$2, 118, 4, 3140);
    			attr_dev(p2, "class", "source-word svelte-ezga6w");
    			add_location(p2, file$2, 119, 4, 3150);
    			attr_dev(p3, "class", "source-sentence svelte-ezga6w");
    			add_location(p3, file$2, 120, 4, 3206);
    			attr_dev(button0, "class", "previous-button svelte-ezga6w");
    			add_location(button0, file$2, 124, 4, 3359);
    			attr_dev(button1, "class", "next-button svelte-ezga6w");
    			add_location(button1, file$2, 125, 4, 3479);
    			attr_dev(p4, "class", "svelte-ezga6w");
    			add_location(p4, file$2, 126, 4, 3598);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p0, anchor);
    			mount_component(targetsentence, p0, null);
    			append_dev(p0, span);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, p1, anchor);
    			append_dev(p1, t1);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, hr, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, p2, anchor);
    			append_dev(p2, t4);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, p3, anchor);
    			append_dev(p3, t6);
    			insert_dev(target, t7, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, t8, anchor);
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t10, anchor);
    			insert_dev(target, button1, anchor);
    			insert_dev(target, t12, anchor);
    			insert_dev(target, p4, anchor);
    			append_dev(p4, t13);
    			append_dev(p4, t14);
    			append_dev(p4, t15);
    			append_dev(p4, t16);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler*/ ctx[4], false, false, false),
    					listen_dev(button1, "click", /*click_handler_1*/ ctx[5], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			const targetsentence_changes = {};
    			if (dirty & /*wordObj*/ 2) targetsentence_changes.wordObj = /*wordObj*/ ctx[1];
    			targetsentence.$set(targetsentence_changes);
    			if ((!current || dirty & /*wordObj*/ 2) && t1_value !== (t1_value = /*wordObj*/ ctx[1].type + "")) set_data_dev(t1, t1_value);
    			if ((!current || dirty & /*wordObj*/ 2) && t4_value !== (t4_value = /*wordObj*/ ctx[1].english_word + "")) set_data_dev(t4, t4_value);
    			if ((!current || dirty & /*wordObj*/ 2) && t6_value !== (t6_value = /*wordObj*/ ctx[1].english_sentence + "")) set_data_dev(t6, t6_value);

    			if (/*wordObj*/ ctx[1].notes) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.m(t8.parentNode, t8);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if ((!current || dirty & /*wordObj*/ 2) && t14_value !== (t14_value = /*wordObj*/ ctx[1].id + "")) set_data_dev(t14, t14_value);
    			if ((!current || dirty & /*wordObj*/ 2) && t16_value !== (t16_value = /*wordObj*/ ctx[1].turkish_word + "")) set_data_dev(t16, t16_value);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(targetsentence.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(targetsentence.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p0);
    			destroy_component(targetsentence);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(p1);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(hr);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(p2);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(p3);
    			if (detaching) detach_dev(t7);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(t8);
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t10);
    			if (detaching) detach_dev(button1);
    			if (detaching) detach_dev(t12);
    			if (detaching) detach_dev(p4);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(116:4) <Card>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let card;
    	let current;

    	card = new Card({
    			props: {
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(card.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(card, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const card_changes = {};

    			if (dirty & /*$$scope, wordObj, activeId*/ 1027) {
    				card_changes.$$scope = { dirty, ctx };
    			}

    			card.$set(card_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(card.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(card.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(card, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function createSet(bins) {
    	let set = [];

    	bins.forEach(bin => bin.forEach(item => {
    		if (Math.random() > 0.8 && set.length <= 40) {
    			set = [...set, item];
    		}
    	}));

    	return set;
    }

    function find(bins, item) {
    	return bins.map(bin => bin.includes(item)).indexOf(true);
    }

    function remove(bins, item) {
    	return bins.map(bin => bin.filter(x => x != item));
    }

    function add(bins, targetIndex, item) {
    	return bins.map((bin, binIndex) => {
    		if (binIndex == targetIndex) return [...bin, item]; else return bin;
    	});
    }

    function promote(bins, item) {
    	const currentBin = find(bins, item);

    	if (currentBin != 99) {
    		bins = remove(bins, item);
    		bins = add(bins, currentBin + 1, item);
    	}

    	return bins;
    }

    function demote(bins, item) {
    	const currentBin = find(bins, item);

    	if (currentBin != 0) {
    		bins = remove(bins, item);
    		bins = add(bins, currentBin + -1, item);
    	}

    	return bins;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let url;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('WordDetails', slots, []);

    	let wordObj = {
    		"id": 1,
    		"turkish_word": "ve",
    		"english_word": "and",
    		"type": "conj",
    		"turkish_sentence": "Ankara ve İstanbul Türkiye’nin büyük şehirlerindendir.",
    		"english_sentence": "Ankara and Istanbul are some of Turkey’s larger cities."
    	};

    	///////////////////////////////////////////////////
    	//////////// Spaced Repetition Logic //////////////
    	const range = (s, e) => e > s ? [s, ...range(s + 1, e)] : [s];

    	let bins = initBins();

    	function initBins() {
    		let bins = [];

    		for (let i = 0; i < 100; i++) {
    			bins[i] = range(i * 20 + 1, i * 20 + 20);
    		}

    		return bins;
    	}

    	//////////////////////////////////////////////////
    	let set = createSet(bins);

    	console.log(set);
    	let activeId = 1;
    	activeId = set.shift(); // <-----------DEBUG
    	console.log(activeId);

    	function handleSuccess() {
    		$$invalidate(0, activeId = set.shift());
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<WordDetails> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => $$invalidate(0, activeId = activeId - 1 < 1 ? 1 : activeId - 1);
    	const click_handler_1 = () => $$invalidate(0, activeId = activeId + 1 > 2000 ? 2000 : activeId + 1);

    	$$self.$capture_state = () => ({
    		Card,
    		TargetSentence,
    		wordObj,
    		range,
    		bins,
    		createSet,
    		initBins,
    		find,
    		remove,
    		add,
    		promote,
    		demote,
    		set,
    		activeId,
    		handleSuccess,
    		url
    	});

    	$$self.$inject_state = $$props => {
    		if ('wordObj' in $$props) $$invalidate(1, wordObj = $$props.wordObj);
    		if ('bins' in $$props) bins = $$props.bins;
    		if ('set' in $$props) set = $$props.set;
    		if ('activeId' in $$props) $$invalidate(0, activeId = $$props.activeId);
    		if ('url' in $$props) $$invalidate(3, url = $$props.url);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*activeId*/ 1) {
    			$$invalidate(3, url = `http://localhost:3060/words/${activeId}`);
    		}

    		if ($$self.$$.dirty & /*url*/ 8) {
    			{
    				fetch(url).then(res => res.json()).then(data => {
    					$$invalidate(1, wordObj = data);
    				});
    			}
    		}
    	};

    	return [activeId, wordObj, handleSuccess, url, click_handler, click_handler_1];
    }

    class WordDetails extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "WordDetails",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src\components\CharacterButtons.svelte generated by Svelte v3.46.4 */

    const { Object: Object_1, console: console_1 } = globals;
    const file$1 = "src\\components\\CharacterButtons.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	return child_ctx;
    }

    // (32:4) {:else}
    function create_else_block(ctx) {
    	let button;
    	let t_value = /*character*/ ctx[9] + "";
    	let t;
    	let mounted;
    	let dispose;

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[6](/*character*/ ctx[9]);
    	}

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text(t_value);
    			attr_dev(button, "class", "svelte-1vc0xr4");
    			add_location(button, file$1, 32, 8, 1034);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "keydown", /*handleKeyDown*/ ctx[3], false, false, false),
    					listen_dev(button, "mousedown", prevent_default(/*mousedown_handler*/ ctx[4]), false, true, false),
    					listen_dev(button, "click", click_handler_1, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(32:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (30:4) {#if is_shift}
    function create_if_block(ctx) {
    	let button;
    	let t_value = /*character*/ ctx[9].toUpperCase() + "";
    	let t;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[5](/*character*/ ctx[9]);
    	}

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text(t_value);
    			attr_dev(button, "class", "svelte-1vc0xr4");
    			add_location(button, file$1, 30, 8, 902);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "keydown", /*handleKeyDown*/ ctx[3], false, false, false),
    					listen_dev(button, "click", click_handler, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(30:4) {#if is_shift}",
    		ctx
    	});

    	return block;
    }

    // (29:0) {#each characterList as character}
    function create_each_block(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*is_shift*/ ctx[0]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(29:0) {#each characterList as character}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let each_1_anchor;
    	let each_value = /*characterList*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*handleKeyDown, handleClick, characterList, is_shift*/ 15) {
    				each_value = /*characterList*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('CharacterButtons', slots, []);
    	const dispatch = createEventDispatcher();
    	let { is_shift } = $$props;
    	const characterList = ['ç', 'ğ', 'ı', 'i', 'ö', 'ş', 'ü'];
    	const characterMap = Object.assign({}, characterList);

    	const handleClick = function (character) {
    		if (is_shift) {
    			document.querySelector(".text-input").value += character.toUpperCase();
    		} else {
    			document.querySelector(".text-input").value += character;
    		}
    	};

    	const handleKeyDown = function (event) {
    		console.log(event.key);

    		if (event.key === 'Backspace' || event.key === 'Delete') {
    			const currentString = document.querySelector(".text-input").value;
    			const newString = currentString.slice(0, -1);
    			document.querySelector(".text-input").value = newString;
    		}
    	};

    	const writable_props = ['is_shift'];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<CharacterButtons> was created with unknown prop '${key}'`);
    	});

    	function mousedown_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	const click_handler = character => handleClick(character);
    	const click_handler_1 = character => handleClick(character);

    	$$self.$$set = $$props => {
    		if ('is_shift' in $$props) $$invalidate(0, is_shift = $$props.is_shift);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		dispatch,
    		is_shift,
    		characterList,
    		characterMap,
    		handleClick,
    		handleKeyDown
    	});

    	$$self.$inject_state = $$props => {
    		if ('is_shift' in $$props) $$invalidate(0, is_shift = $$props.is_shift);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		is_shift,
    		characterList,
    		handleClick,
    		handleKeyDown,
    		mousedown_handler,
    		click_handler,
    		click_handler_1
    	];
    }

    class CharacterButtons extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { is_shift: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CharacterButtons",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*is_shift*/ ctx[0] === undefined && !('is_shift' in props)) {
    			console_1.warn("<CharacterButtons> was created without expected prop 'is_shift'");
    		}
    	}

    	get is_shift() {
    		throw new Error("<CharacterButtons>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set is_shift(value) {
    		throw new Error("<CharacterButtons>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\App.svelte generated by Svelte v3.46.4 */
    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let header;
    	let t0;
    	let main;
    	let worddetails;
    	let t1;
    	let characterbuttons;
    	let current;
    	let mounted;
    	let dispose;
    	header = new Header({ $$inline: true });
    	worddetails = new WordDetails({ $$inline: true });

    	characterbuttons = new CharacterButtons({
    			props: { is_shift: /*is_shift*/ ctx[0] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(header.$$.fragment);
    			t0 = space();
    			main = element("main");
    			create_component(worddetails.$$.fragment);
    			t1 = space();
    			create_component(characterbuttons.$$.fragment);
    			attr_dev(main, "class", "svelte-1h6otfa");
    			add_location(main, file, 18, 0, 409);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(header, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, main, anchor);
    			mount_component(worddetails, main, null);
    			append_dev(main, t1);
    			mount_component(characterbuttons, main, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(main, "keyup", /*handleKeyUp*/ ctx[2], false, false, false),
    					listen_dev(main, "keydown", /*handleKeydown*/ ctx[1], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const characterbuttons_changes = {};
    			if (dirty & /*is_shift*/ 1) characterbuttons_changes.is_shift = /*is_shift*/ ctx[0];
    			characterbuttons.$set(characterbuttons_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(header.$$.fragment, local);
    			transition_in(worddetails.$$.fragment, local);
    			transition_in(characterbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(header.$$.fragment, local);
    			transition_out(worddetails.$$.fragment, local);
    			transition_out(characterbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(header, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(main);
    			destroy_component(worddetails);
    			destroy_component(characterbuttons);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let is_shift = false;

    	const handleKeydown = event => {
    		if (event.key === 'Shift') $$invalidate(0, is_shift = true);
    	};

    	const handleKeyUp = event => {
    		if (event.key === 'Shift') $$invalidate(0, is_shift = false);
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Header,
    		WordDetails,
    		CharacterButtons,
    		is_shift,
    		handleKeydown,
    		handleKeyUp
    	});

    	$$self.$inject_state = $$props => {
    		if ('is_shift' in $$props) $$invalidate(0, is_shift = $$props.is_shift);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [is_shift, handleKeydown, handleKeyUp];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
