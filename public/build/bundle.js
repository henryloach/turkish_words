
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

    const words = [
        {
           "id": 1,
           "turkish_word": "ve",
           "english_word": "and",
           "type": "conj",
           "turkish_sentence": "Ankara ve İstanbul Türkiye’nin büyük şehirlerindendir.",
           "english_sentence": "Ankara and Istanbul are some of Turkey’s larger cities."
        },
        {
           "id": 2,
           "turkish_word": "bir",
           "english_word": "one",
           "type": "adj",
           "turkish_sentence": "Bugün ben sadece bir dilim ekmek yedim.",
           "english_sentence": "I only ate one slice of bread today."
        },
        {
           "id": 3,
           "turkish_word": "bu",
           "english_word": "this",
           "type": "pron",
           "turkish_sentence": "Bu benim arabamın aynısı.",
           "english_sentence": "This is the same as my car."
        },
        {
           "id": 4,
           "turkish_word": "da",
           "english_word": "also",
           "type": "conj",
           "turkish_sentence": "Ezgi dedi ki Osman da bizimle gelecekmiş.",
           "english_sentence": "Ezgi said that Osman was coming with us also.",
           "notes": "-de / -da is added according to the vowel in the last syllable. It can also refer to location when used as a suffix."
        },
        {
           "id": 5,
           "turkish_word": "de",
           "english_word": "also",
           "type": "conj",
           "turkish_sentence": "Kediler iyi avcılardır ama köpekler de iyi avcılardır.",
           "english_sentence": "Cats are good hunters, but dogs are also good hunters.",
           "notes": "a variation of “da”. It also may refer to location when used as a suffix."
        },
        {
           "id": 6,
           "turkish_word": "için",
           "english_word": "in order to",
           "type": "postp",
           "turkish_sentence": "Peynir almak için markete gittim.",
           "english_sentence": "I went to the market in order to get cheese."
        },
        {
           "id": 7,
           "turkish_word": "ile",
           "english_word": "and",
           "type": "conj",
           "turkish_sentence": "Siyah ile beyaz zıt renklerdir.",
           "english_sentence": "Black and white are opposite colors."
        },
        {
           "id": 8,
           "turkish_word": "çok",
           "english_word": "a lot",
           "type": "adj",
           "turkish_sentence": "O kadar çok kuşu var ki artık onlara bakamıyor.",
           "english_sentence": "She has such a lot of birds that she can’t take care of them anymore."
        },
        {
           "id": 9,
           "turkish_word": "olarak",
           "english_word": "as",
           "type": "ptcp",
           "turkish_sentence": "Beş senedir benim aşçım olarak çalışıyor.",
           "english_sentence": "He has been working as my cook for five years."
        },
        {
           "id": 10,
           "turkish_word": "daha",
           "english_word": "more",
           "type": "adv",
           "turkish_sentence": "Soğuk havada bir kat daha giymelisin.",
           "english_sentence": "In cold weather you should put on one more layer."
        },
        {
           "id": 11,
           "turkish_word": "olan",
           "english_word": "one; somebody",
           "type": "pron",
           "turkish_sentence": "Kalemi olan var mı?",
           "english_sentence": "Does anyone have a pencil?"
        },
        {
           "id": 12,
           "turkish_word": "gibi",
           "english_word": "like",
           "type": "postp",
           "turkish_sentence": "Bu havuzun suyu deniz suyu gibi tuzlu.",
           "english_sentence": "This pool’s water is salty like sea water."
        },
        {
           "id": 13,
           "turkish_word": "en",
           "english_word": "most",
           "type": "adv",
           "turkish_sentence": "En okunabilir olanı onun el yazısı.",
           "english_sentence": "She has the most readable handwriting."
        },
        {
           "id": 14,
           "turkish_word": "her",
           "english_word": "each",
           "type": "adj",
           "turkish_sentence": "Her evi delil bulmak için arayacaklarmış.",
           "english_sentence": "They are going to search each house to find evidence."
        },
        {
           "id": 15,
           "turkish_word": "o",
           "english_word": "he/she/it",
           "type": "pron",
           "turkish_sentence": "O beni köye götürdü.",
           "english_sentence": "He/she took me to the village.",
           "notes": "The third-person singular pronoun is gender-neutral."
        },
        {
           "id": 16,
           "turkish_word": "ne",
           "english_word": "what",
           "type": "pron",
           "turkish_sentence": "Onun burada işi ne ?",
           "english_sentence": "What is he/she doing here?"
        },
        {
           "id": 17,
           "turkish_word": "kadar",
           "english_word": "until",
           "type": "postp",
           "turkish_sentence": "Doyuncaya kadar yedim.",
           "english_sentence": "I ate until I was full."
        },
        {
           "id": 18,
           "turkish_word": "ama",
           "english_word": "but",
           "type": "conj",
           "turkish_sentence": "Ben kendimi yaşlı sanıyordum ama sen benden daha yaşlısın.",
           "english_sentence": "I thought I was old, but you are older than me."
        },
        {
           "id": 19,
           "turkish_word": "sonra",
           "english_word": "after",
           "type": "postp",
           "turkish_sentence": "Dersten sonra yemek yemeye gideceğiz.",
           "english_sentence": "We are going to go to dinner after the lesson."
        },
        {
           "id": 20,
           "turkish_word": "-nin",
           "english_word": "of",
           "type": "poss",
           "turkish_sentence": "Veli’nin babasını yeni gördüm.",
           "english_sentence": "I just saw the father of Veli."
        },
        {
           "id": 21,
           "turkish_word": "ise",
           "english_word": "if",
           "type": "conj",
           "turkish_sentence": "Bu bardak plastik ise yere düşünce kırılmaz.",
           "english_sentence": "If this cup is made of plastic it won’t break when it falls."
        },
        {
           "id": 22,
           "turkish_word": "ya",
           "english_word": "either",
           "type": "conj",
           "turkish_sentence": "Ya sen bize gelirsin ya da dışarıda buluşuruz.",
           "english_sentence": "Either you come to our place or we’ll meet outdoors."
        },
        {
           "id": 23,
           "turkish_word": "ki",
           "english_word": "that",
           "type": "adj",
           "turkish_sentence": "Oradaki çantayı bana verir misin?",
           "english_sentence": "Could you give me that bag over there?"
        },
        {
           "id": 24,
           "turkish_word": "Türkiye",
           "english_word": "Turkey",
           "type": "n",
           "turkish_sentence": "Bu yaz Türkiye’ye tatile gitmek istiyorum.",
           "english_sentence": "I want to go to Turkey this summer for a vacation."
        },
        {
           "id": 25,
           "turkish_word": "var",
           "english_word": "there is",
           "type": "adv",
           "turkish_sentence": "Cebimde bir avro var.",
           "english_sentence": "There is one euro in my pocket."
        },
        {
           "id": 26,
           "turkish_word": "-in",
           "english_word": "of",
           "type": "poss",
           "turkish_sentence": "Ali’nin kızını Veli’yle evlendirdiler.",
           "english_sentence": "They married the daughter of Ali to Veli.",
           "notes": "possessive pronouns change according to the vowel in the last syllable."
        },
        {
           "id": 27,
           "turkish_word": "büyük",
           "english_word": "large",
           "type": "adj",
           "turkish_sentence": "Karşıda büyük bir gemi duruyor.",
           "english_sentence": "There is a large ship across there."
        },
        {
           "id": 28,
           "turkish_word": "-ın",
           "english_word": "of",
           "type": "poss",
           "turkish_sentence": "Aslanın ziyafetini vahşi köpekler kaptı.",
           "english_sentence": "Wild dogs stole the feast of the lion.",
           "notes": "This possessive pronoun changes according to the vowel in the last syllable."
        },
        {
           "id": 29,
           "turkish_word": "yeni",
           "english_word": "new",
           "type": "adj",
           "turkish_sentence": "Onun yeni ceketi cok pahalıymış.",
           "english_sentence": "His new jacket is very expensive."
        },
        {
           "id": 30,
           "turkish_word": "ilk",
           "english_word": "first",
           "type": "adj",
           "turkish_sentence": "Bebek ilk adımını attı.",
           "english_sentence": "The baby took its first step."
        },
        {
           "id": 31,
           "turkish_word": "-a",
           "english_word": "to",
           "type": "suf",
           "turkish_sentence": "Bu hafta pazara gitmek lazım.",
           "english_sentence": "We should go to the bazaar this week.",
           "notes": "used to form dative case"
        },
        {
           "id": 32,
           "turkish_word": "olduğu",
           "english_word": "as",
           "type": "ptcp",
           "turkish_sentence": "Mümkün olduğu kadar hızlı geldim.",
           "english_sentence": "I came as fast as possible."
        },
        {
           "id": 33,
           "turkish_word": "zaman",
           "english_word": "time",
           "type": "n",
           "turkish_sentence": "Zaman ne kadar hızlı geçiyor!",
           "english_sentence": "How time flies!"
        },
        {
           "id": 34,
           "turkish_word": "iyi",
           "english_word": "good",
           "type": "adj",
           "turkish_sentence": "Börek yapmak için iyi peynir seçtim.",
           "english_sentence": "I chose a good cheese to make pie."
        },
        {
           "id": 35,
           "turkish_word": "ben",
           "english_word": "me",
           "type": "pron",
           "turkish_sentence": "Kapıyı ben çaldım.",
           "english_sentence": "It was me knocking on the door."
        },
        {
           "id": 36,
           "turkish_word": "olduğunu",
           "english_word": "that",
           "type": "ptcp",
           "turkish_sentence": "Bana uzun zaman olduğunu söyledi.",
           "english_sentence": "He told me that it had been a long time.",
           "notes": "it was"
        },
        {
           "id": 37,
           "turkish_word": "değil",
           "english_word": "not",
           "type": "n",
           "turkish_sentence": "Yalan söylemek doğru değil.",
           "english_sentence": "It is not right to lie."
        },
        {
           "id": 38,
           "turkish_word": "son",
           "english_word": "end/ending",
           "type": "n",
           "turkish_sentence": "Filmin sonunu merak ediyorum.",
           "english_sentence": "I am curious about the movie’s ending."
        },
        {
           "id": 39,
           "turkish_word": "iki",
           "english_word": "two",
           "type": "adj",
           "turkish_sentence": "Günde iki kere dişlerimi fırçalarım.",
           "english_sentence": "I brush my teeth two times a day."
        },
        {
           "id": 40,
           "turkish_word": "göre",
           "english_word": "than",
           "type": "postp",
           "turkish_sentence": "Eskiye göre daha fitim.",
           "english_sentence": "I am more fit than I used to be."
        },
        {
           "id": 41,
           "turkish_word": "-nın",
           "english_word": "‘s",
           "type": "poss",
           "turkish_sentence": "Leyla’nın yeni elbisesi çok güzel.",
           "english_sentence": "Leyla’s new dress is very pretty.",
           "notes": "used to transfer nouns to their possessive form"
        },
        {
           "id": 42,
           "turkish_word": "veya",
           "english_word": "or",
           "type": "conj",
           "turkish_sentence": "Evin eski veya yeni olması fark etmez.",
           "english_sentence": "It doesn’t matter if the house is old or new."
        },
        {
           "id": 43,
           "turkish_word": "ancak",
           "english_word": "but",
           "type": "conj",
           "turkish_sentence": "Gelecekler, ancak biraz geç kalacaklar.",
           "english_sentence": "They will come but they will be a little late."
        },
        {
           "id": 44,
           "turkish_word": "tarafından",
           "english_word": "by",
           "type": "postp",
           "turkish_sentence": "Öğretmen tarafından uyarıldım.",
           "english_sentence": "I was warned by the teacher."
        },
        {
           "id": 45,
           "turkish_word": "önce",
           "english_word": "before",
           "type": "adv",
           "turkish_sentence": "Öğleden önce işlerimi bitirmiştim.",
           "english_sentence": "I had finished my work before noon."
        },
        {
           "id": 46,
           "turkish_word": "diye",
           "english_word": "because",
           "type": "conj",
           "turkish_sentence": "Elif, biz fazla konuşuyoruz diye sıkılmış.",
           "english_sentence": "Elif was bored because we were talking too much."
        },
        {
           "id": 47,
           "turkish_word": "içinde",
           "english_word": "in",
           "type": "adv",
           "turkish_sentence": "Köyün içinde bir fırın var.",
           "english_sentence": "There is a bakery in the village."
        },
        {
           "id": 48,
           "turkish_word": "tüm",
           "english_word": "all",
           "type": "adj",
           "turkish_sentence": "Tüm gençler basketbol oyununa katıldılar.",
           "english_sentence": "All the young people joined in the basketball game."
        },
        {
           "id": 49,
           "turkish_word": "kendi",
           "english_word": "himself / herself",
           "type": "pron",
           "turkish_sentence": "Arif kendisi gibi bir arkadaş arıyor.",
           "english_sentence": "Arif is looking for a friend similar to himself."
        },
        {
           "id": 50,
           "turkish_word": "aynı",
           "english_word": "same",
           "type": "adv",
           "turkish_sentence": "Burada her şey aynı görünüyor.",
           "english_sentence": "Here everything looks the same."
        },
        {
           "id": 51,
           "turkish_word": "önemli",
           "english_word": "important",
           "type": "adj",
           "turkish_sentence": "Önemli bir işim olduğu için gelmedim.",
           "english_sentence": "I didn’t come because I had an important job to do."
        },
        {
           "id": 52,
           "turkish_word": "ilgili",
           "english_word": "interested",
           "type": "adj",
           "turkish_sentence": "Çocuklar derse çok ilgili değiller.",
           "english_sentence": "The children are not very interested in the lesson."
        },
        {
           "id": 53,
           "turkish_word": "yer",
           "english_word": "place",
           "type": "n",
           "turkish_sentence": "Hiçbir yer burası kadar güzel değil.",
           "english_sentence": "No place is as nice as it is here."
        },
        {
           "id": 54,
           "turkish_word": "sadece",
           "english_word": "only",
           "type": "adv",
           "turkish_sentence": "Ona sadece bir saat süreceğini söyledim.",
           "english_sentence": "I told him that it would only take an hour."
        },
        {
           "id": 55,
           "turkish_word": "hem",
           "english_word": "plus",
           "type": "adv",
           "turkish_sentence": "Orhan’ın evi hem çok pahalı hem de küçük.",
           "english_sentence": "That house is very expensive plus it’s small."
        },
        {
           "id": 56,
           "turkish_word": "yok",
           "english_word": "not",
           "type": "postp",
           "turkish_sentence": "Kasada bugün para yok.",
           "english_sentence": "There is not any money in the till today."
        },
        {
           "id": 57,
           "turkish_word": "şekilde",
           "english_word": "",
           "type": "adv",
           "turkish_sentence": "Bu şekilde davranırsan ceza alırsın.",
           "english_sentence": "If you act this way you will be punished.",
           "notes": "in the"
        },
        {
           "id": 58,
           "turkish_word": "diğer",
           "english_word": "other",
           "type": "adj",
           "turkish_sentence": "Balıkçı diğer bota bindi.",
           "english_sentence": "The fisherman got into the other boat."
        },
        {
           "id": 59,
           "turkish_word": "devam",
           "english_word": "continue",
           "type": "n",
           "turkish_sentence": "Film devam etmedi.",
           "english_sentence": "The movie did not continue."
        },
        {
           "id": 60,
           "turkish_word": "gün",
           "english_word": "day",
           "type": "n",
           "turkish_sentence": "Tatile kaç gün kaldı?",
           "english_sentence": "How many days left until the holidays?"
        },
        {
           "id": 61,
           "turkish_word": "Türk",
           "english_word": "Turk",
           "type": "n",
           "turkish_sentence": "Uçakta sadece Türk yolcular vardı.",
           "english_sentence": "There were only Turk passengers on the plane."
        },
        {
           "id": 62,
           "turkish_word": "arasında",
           "english_word": "between",
           "type": "postp",
           "turkish_sentence": "Yastıkların arasında parlayan bir şey var.",
           "english_sentence": "There is something shining between the pillows."
        },
        {
           "id": 63,
           "turkish_word": "yıl",
           "english_word": "year",
           "type": "n",
           "turkish_sentence": "Dört yıl sonra mezun olacakmış.",
           "english_sentence": "She is going to graduate four year s later."
        },
        {
           "id": 64,
           "turkish_word": "bile",
           "english_word": "even",
           "type": "conj",
           "turkish_sentence": "Çok hızlı koşuyor, onu bisikletle bile geçemiyorlar.",
           "english_sentence": "He runs very fast; they cannot even pass him on a bike."
        },
        {
           "id": 65,
           "turkish_word": "karşı",
           "english_word": "across from",
           "type": "adj",
           "turkish_sentence": "Karşı evde bir hanımefendi yaşıyor.",
           "english_sentence": "A lady lives in the house across from here."
        },
        {
           "id": 66,
           "turkish_word": "başkanı",
           "english_word": "head of",
           "type": "n",
           "turkish_sentence": "Sınıf başkanı olduğuma sevindim.",
           "english_sentence": "I am glad that I’m the head of class."
        },
        {
           "id": 67,
           "turkish_word": "hiç",
           "english_word": "ever",
           "type": "adv",
           "turkish_sentence": "Bunu hiç düşündün mü?",
           "english_sentence": "Have you ever thought about this?"
        },
        {
           "id": 68,
           "turkish_word": "-e",
           "english_word": "towards",
           "type": "suf",
           "turkish_sentence": "Sahile doğru yürü, bizi görürsün.",
           "english_sentence": "Walk towards the seaside, you’ll see us.",
           "notes": "added to a noun to form locative case"
        },
        {
           "id": 69,
           "turkish_word": "nasıl",
           "english_word": "how",
           "type": "adv",
           "turkish_sentence": "Buraya nasıl geldin?",
           "english_sentence": "How did you get here?"
        },
        {
           "id": 70,
           "turkish_word": "genel",
           "english_word": "general",
           "type": "adj",
           "turkish_sentence": "Genel olarak hayvanlar hakkında konuşabilirim.",
           "english_sentence": "I can talk about animals in general."
        },
        {
           "id": 71,
           "turkish_word": "tek",
           "english_word": "only",
           "type": "adj",
           "turkish_sentence": "Tek bir gözümüz olsaydı iyi göremezdik.",
           "english_sentence": "We would not be able to see well with only one eye."
        },
        {
           "id": 72,
           "turkish_word": "oldu",
           "english_word": "became",
           "type": "v",
           "turkish_sentence": "Birden her şey pembe oldu.",
           "english_sentence": "All of a sudden everything became pink."
        },
        {
           "id": 73,
           "turkish_word": "şey",
           "english_word": "thing",
           "type": "n",
           "turkish_sentence": "En önemli şey sağlık.",
           "english_sentence": "The most important thing is health."
        },
        {
           "id": 74,
           "turkish_word": "fazla",
           "english_word": "too",
           "type": "adv",
           "turkish_sentence": "Bu iş bana fazla zor geldi.",
           "english_sentence": "I feel that this job is too hard for me."
        },
        {
           "id": 75,
           "turkish_word": "birlikte",
           "english_word": "together",
           "type": "adv",
           "turkish_sentence": "Babamla kardeşim birlikte tatile gittiler.",
           "english_sentence": "My father and brother went on holiday together."
        },
        {
           "id": 76,
           "turkish_word": "böyle",
           "english_word": "like this",
           "type": "adv",
           "turkish_sentence": "Ben böyle çalışmaya alışkın değilim.",
           "english_sentence": "I am not used to working like this."
        },
        {
           "id": 77,
           "turkish_word": "bunun",
           "english_word": "this is",
           "type": "adv",
           "turkish_sentence": "Ben bunun için sinirlendim.",
           "english_sentence": "This is why I got angry."
        },
        {
           "id": 78,
           "turkish_word": "başka",
           "english_word": "another",
           "type": "adj",
           "turkish_sentence": "Onların başka bir siparişi yokmuş.",
           "english_sentence": "They do not have another order."
        },
        {
           "id": 79,
           "turkish_word": "yapılan",
           "english_word": "made",
           "type": "ptcp",
           "turkish_sentence": "Yeni yapılan bütün binalar depremde çökmüş.",
           "english_sentence": "All the newly made buildings collapsed during the earthquake."
        },
        {
           "id": 80,
           "turkish_word": "bütün",
           "english_word": "all",
           "type": "adj",
           "turkish_sentence": "Bütün notlarım iyi geldi.",
           "english_sentence": "All my grades were good."
        },
        {
           "id": 81,
           "turkish_word": "dedi",
           "english_word": "said",
           "type": "v",
           "turkish_sentence": "Acaba kim dedi ?",
           "english_sentence": "I wonder who said so?"
        },
        {
           "id": 82,
           "turkish_word": "eden",
           "english_word": "does",
           "type": "ptcp/pron",
           "turkish_sentence": "Her eden bulur.",
           "english_sentence": "Whoever does something will face the consequences."
        },
        {
           "id": 83,
           "turkish_word": "çünkü",
           "english_word": "because",
           "type": "conj",
           "turkish_sentence": "Pazara gitmedim çünkü evde çok yemek vardı.",
           "english_sentence": "I did not go to the market because there was too much food at home."
        },
        {
           "id": 84,
           "turkish_word": "yani",
           "english_word": "or",
           "type": "adv",
           "turkish_sentence": "Yarın sınavım var, yani bu akşam ders çalışmam lazım.",
           "english_sentence": "I have got an exam tomorrow, so I have to study tonight."
        },
        {
           "id": 85,
           "turkish_word": "güzel",
           "english_word": "beautiful",
           "type": "adj",
           "turkish_sentence": "Her çocuk güzel dir.",
           "english_sentence": "All children are beautiful."
        },
        {
           "id": 86,
           "turkish_word": "bu",
           "english_word": "this",
           "type": "adj/pron",
           "turkish_sentence": "Sen bu nu dükkana götür.",
           "english_sentence": "You take this to the shop."
        },
        {
           "id": 87,
           "turkish_word": "şu",
           "english_word": "this",
           "type": "adj/pron",
           "turkish_sentence": "Şu şişeyi güneşli bir yere koy.",
           "english_sentence": "Put this bottle in a sunny spot."
        },
        {
           "id": 88,
           "turkish_word": "gelen",
           "english_word": "coming",
           "type": "ptcp",
           "turkish_sentence": "O, her gelen misafire çay ikram eder.",
           "english_sentence": "He offers tea to each coming visitor."
        },
        {
           "id": 89,
           "turkish_word": "insan",
           "english_word": "person",
           "type": "n",
           "turkish_sentence": "İyi insan olmak için çabalıyorum.",
           "english_sentence": "I am trying to be a good person."
        },
        {
           "id": 90,
           "turkish_word": "iş",
           "english_word": "job",
           "type": "n",
           "turkish_sentence": "Günde bir iş yapabiliyorum.",
           "english_sentence": "I can do one job a day."
        },
        {
           "id": 91,
           "turkish_word": "biz",
           "english_word": "we",
           "type": "pron",
           "turkish_sentence": "Biz çok iyi arkadaşız.",
           "english_sentence": "We are very good friends."
        },
        {
           "id": 92,
           "turkish_word": "bazı",
           "english_word": "some",
           "type": "adj",
           "turkish_sentence": "Bazı zamanlar ona dayanamıyorum.",
           "english_sentence": "Some times I cannot stand her."
        },
        {
           "id": 93,
           "turkish_word": "doğru",
           "english_word": "right",
           "type": "adj",
           "turkish_sentence": "Sınavdaki yanlış cevaplarım doğru larımdan fazlaydı.",
           "english_sentence": "My wrong answers were more frequent than my right answers."
        },
        {
           "id": 94,
           "turkish_word": "yine",
           "english_word": "again",
           "type": "adv",
           "turkish_sentence": "Yine geç kaldı işe!",
           "english_sentence": "She is late for work again !"
        },
        {
           "id": 95,
           "turkish_word": "-un",
           "english_word": "‘s",
           "type": "poss",
           "turkish_sentence": "Orhun’un iş yeri yeni açılmış.",
           "english_sentence": "Orhun’s workplace just opened recently."
        },
        {
           "id": 96,
           "turkish_word": "ortaya",
           "english_word": "center",
           "type": "adv",
           "turkish_sentence": "Ortaya kocaman bir tabak koydu.",
           "english_sentence": "He put a large plate in the center."
        },
        {
           "id": 97,
           "turkish_word": "-ye",
           "english_word": "to/at",
           "type": "suf",
           "turkish_sentence": "Hediyeye mutlulukla baktı.",
           "english_sentence": "She looked at the gift with joy.",
           "notes": "same as the suffix -e, used when the preceding sound is a vowel"
        },
        {
           "id": 98,
           "turkish_word": "-i",
           "english_word": "‘s",
           "type": "poss",
           "turkish_sentence": "Teoman’ın kalemi kırıldı.",
           "english_sentence": "Teoman’s pencil broke."
        },
        {
           "id": 99,
           "turkish_word": "artık",
           "english_word": "now/from now on/no longer",
           "type": "adv",
           "turkish_sentence": "Artık geri dönmek için çok geç.",
           "english_sentence": "It’s too late to turn back now."
        },
        {
           "id": 100,
           "turkish_word": "özel",
           "english_word": "special",
           "type": "adj",
           "turkish_sentence": "Özel günlerde ailelerimizle olmak isteriz.",
           "english_sentence": "We like to be with our families on special days."
        },
        {
           "id": 101,
           "turkish_word": "olması",
           "english_word": "to be",
           "type": "ptcp",
           "turkish_sentence": "Böyle olması gerekir miydi?",
           "english_sentence": "Did it have to be this way?"
        },
        {
           "id": 102,
           "turkish_word": "sahip",
           "english_word": "owner",
           "type": "n",
           "turkish_sentence": "O kedinin sahib i yok.",
           "english_sentence": "That cat does not have an owner."
        },
        {
           "id": 103,
           "turkish_word": "üzerine",
           "english_word": "upon",
           "type": "postp",
           "turkish_sentence": "Kitabını masanın üzerine koy.",
           "english_sentence": "Put your book upon the table."
        },
        {
           "id": 104,
           "turkish_word": "olmak",
           "english_word": "occur; become",
           "type": "v",
           "turkish_sentence": "Bu hafta iki kere fırtına ol du.",
           "english_sentence": "This week two storms occurred.",
           "notes": "the root is -ol, this takes on different tenses like -du for past tense"
        },
        {
           "id": 105,
           "turkish_word": "eğitim",
           "english_word": "education/training",
           "type": "n",
           "turkish_sentence": "Bilgisayar eğitim i için okula gitti.",
           "english_sentence": "She went to school to get computer training."
        },
        {
           "id": 106,
           "turkish_word": "İstanbul",
           "english_word": "Istanbul",
           "type": "n",
           "turkish_sentence": "İstanbul eskiden başkentti.",
           "english_sentence": "Istanbul used to be the capital city."
        },
        {
           "id": 107,
           "turkish_word": "olur",
           "english_word": "can be/will be ; used to give an affirmative answer",
           "type": "v",
           "turkish_sentence": "Senin yemeğin yarışmada birinci olur.",
           "english_sentence": "Your dish will be given first place in the competition."
        },
        {
           "id": 108,
           "turkish_word": "farklı",
           "english_word": "different",
           "type": "adj",
           "turkish_sentence": "Ben senden farklı değilim.",
           "english_sentence": "I am no different than you."
        },
        {
           "id": 109,
           "turkish_word": "bin",
           "english_word": "a thousand",
           "type": "num",
           "turkish_sentence": "Bin kere özür diledim.",
           "english_sentence": "I apologized a thousand times."
        },
        {
           "id": 110,
           "turkish_word": "mi",
           "english_word": "right?/is it?",
           "type": "interr",
           "turkish_sentence": "Bugün Perşembe değil mi ?",
           "english_sentence": "Today is Thursday, right?"
        },
        {
           "id": 111,
           "turkish_word": "benim",
           "english_word": "my",
           "type": "pron",
           "turkish_sentence": "Benim silgim iyi silmiyor.",
           "english_sentence": "My eraser does not erase well."
        },
        {
           "id": 112,
           "turkish_word": "onun",
           "english_word": "his/her/its",
           "type": "poss",
           "turkish_sentence": "Onun kendi arabası var.",
           "english_sentence": "She has her own car."
        },
        {
           "id": 113,
           "turkish_word": "Allah",
           "english_word": "God",
           "type": "n",
           "turkish_sentence": "Allah senden razı olsun!",
           "english_sentence": "May Allah be pleased with you!"
        },
        {
           "id": 114,
           "turkish_word": "etti",
           "english_word": "did",
           "type": "v",
           "turkish_sentence": "Teklifimi kabul etti.",
           "english_sentence": "He did accept my offer."
        },
        {
           "id": 115,
           "turkish_word": "dünya",
           "english_word": "world",
           "type": "n",
           "turkish_sentence": "Dünya birincisi olmuşum!",
           "english_sentence": "I am the world champion!"
        },
        {
           "id": 116,
           "turkish_word": "üzerinde",
           "english_word": "on, above",
           "type": "postp",
           "turkish_sentence": "Elbisenin üzerinde boncuklar var.",
           "english_sentence": "There are beads on the dress."
        },
        {
           "id": 117,
           "turkish_word": "neden",
           "english_word": "why",
           "type": "adv",
           "turkish_sentence": "Neden saksıyı kaldırdın?",
           "english_sentence": "Why did you take away the flowerpot?"
        },
        {
           "id": 118,
           "turkish_word": "biri",
           "english_word": "somebody",
           "type": "pron",
           "turkish_sentence": "Biri bisikletimi çalmış!",
           "english_sentence": "Somebody has stolen my bike!"
        },
        {
           "id": 119,
           "turkish_word": "ayrıca",
           "english_word": "also",
           "type": "adv",
           "turkish_sentence": "Kek yaptım, ayrıca kurabiye de var.",
           "english_sentence": "I made cake and we also have cookies."
        },
        {
           "id": 120,
           "turkish_word": "-dan",
           "english_word": "from",
           "type": "suf",
           "turkish_sentence": "Ankara’dan İstanbul’a gittim.",
           "english_sentence": "I went from Ankara to Istanbul.",
           "notes": "used to form ablative case"
        },
        {
           "id": 121,
           "turkish_word": "tam",
           "english_word": "full, whole",
           "type": "adj",
           "turkish_sentence": "Bardağı tam doldur.",
           "english_sentence": "Fill the whole glass."
        },
        {
           "id": 122,
           "turkish_word": "uzun",
           "english_word": "long",
           "type": "adj",
           "turkish_sentence": "Uzun yola çıkarken hazırlık yapmalı.",
           "english_sentence": "You should prepare before a long trip."
        },
        {
           "id": 123,
           "turkish_word": "üzere",
           "english_word": "about",
           "type": "adv",
           "turkish_sentence": "Kar yağmak üzere.",
           "english_sentence": "It’s about to snow."
        },
        {
           "id": 124,
           "turkish_word": "alan",
           "english_word": "space",
           "type": "n",
           "turkish_sentence": "Oynamak için az alan ım var.",
           "english_sentence": "I do not have much space to play in."
        },
        {
           "id": 125,
           "turkish_word": "ifade",
           "english_word": "expression",
           "type": "n",
           "turkish_sentence": "Türkiye’yi görmek istediğini ifade etti.",
           "english_sentence": "He expressed an interest in seeing Turkey."
        },
        {
           "id": 126,
           "turkish_word": "bulunan",
           "english_word": "situated",
           "type": "ptcp",
           "turkish_sentence": "Solunuzda bulunan lamba bir antika.",
           "english_sentence": "The lamp situated to your left is an antique piece."
        },
        {
           "id": 127,
           "turkish_word": "kabul",
           "english_word": "acceptance",
           "type": "n",
           "turkish_sentence": "Yeni kitabım kabul gördü.",
           "english_sentence": "My new book was well accepted."
        },
        {
           "id": 128,
           "turkish_word": "özellikle",
           "english_word": "especially",
           "type": "adv",
           "turkish_sentence": "Özellikle mavi balinaları severim.",
           "english_sentence": "I especially like blue whales."
        },
        {
           "id": 129,
           "turkish_word": "yüksek",
           "english_word": "high",
           "type": "adj",
           "turkish_sentence": "Kuşlar yüksek yerlere konmayı sever.",
           "english_sentence": "Birds like to perch on high places."
        },
        {
           "id": 130,
           "turkish_word": "yılında",
           "english_word": "in the year",
           "type": "adv",
           "turkish_sentence": "2000 yılında evlenmiştik.",
           "english_sentence": "We got married in the year 2000."
        },
        {
           "id": 131,
           "turkish_word": "-den",
           "english_word": "from",
           "type": "suf",
           "turkish_sentence": "Yunuslar dipten topu aldı.",
           "english_sentence": "The dolphins retrieved the ball from the deep."
        },
        {
           "id": 132,
           "turkish_word": "vardır",
           "english_word": "has/there is",
           "type": "v",
           "turkish_sentence": "Elinde mutlaka incir vardır.",
           "english_sentence": "He certainly has a fig in his hand."
        },
        {
           "id": 133,
           "turkish_word": "az",
           "english_word": "little",
           "type": "adj",
           "turkish_sentence": "Benim çok az gücüm var.",
           "english_sentence": "I only have a little bit of strength."
        },
        {
           "id": 134,
           "turkish_word": "şimdi",
           "english_word": "now",
           "type": "adv",
           "turkish_sentence": "Ders şimdi başlıyor.",
           "english_sentence": "The lesson starts now."
        },
        {
           "id": 135,
           "turkish_word": "bizim",
           "english_word": "our",
           "type": "pron",
           "turkish_sentence": "Bizim çantamızın sapı kopmuş.",
           "english_sentence": "Our bag’s handle has broken."
        },
        {
           "id": 136,
           "turkish_word": "devlet",
           "english_word": "state",
           "type": "n",
           "turkish_sentence": "Devlet sana görev vermiş.",
           "english_sentence": "The state has given you an assignment."
        },
        {
           "id": 137,
           "turkish_word": "yerine",
           "english_word": "instead",
           "type": "adv",
           "turkish_sentence": "Mine’nin yerine Aslı gelmiş.",
           "english_sentence": "Aslı has come instead of Mine."
        },
        {
           "id": 138,
           "turkish_word": "geçen",
           "english_word": "past; last",
           "type": "ptcp",
           "turkish_sentence": "Gelen geçen gemilere bakıyorum.",
           "english_sentence": "I am watching the ships sailing past."
        },
        {
           "id": 139,
           "turkish_word": "bugün",
           "english_word": "today",
           "type": "adv",
           "turkish_sentence": "Bugün herkes tatil yapıyor.",
           "english_sentence": "Today everyone is on holiday."
        },
        {
           "id": 140,
           "turkish_word": "yüzde",
           "english_word": "percent",
           "type": "adj",
           "turkish_sentence": "Yüzde yüz başarılı oldu.",
           "english_sentence": "She was one hundred percent successful."
        },
        {
           "id": 141,
           "turkish_word": "hiçbir",
           "english_word": "no one",
           "type": "pron",
           "turkish_sentence": "Hiçbir kimse onu sevmiyor.",
           "english_sentence": "No one likes him."
        },
        {
           "id": 142,
           "turkish_word": "eğer",
           "english_word": "if",
           "type": "conj",
           "turkish_sentence": "Eğer gelmezsen sonucu bildirmezler.",
           "english_sentence": "If you do not come, they will not announce the result."
        },
        {
           "id": 143,
           "turkish_word": "onu",
           "english_word": "him/her",
           "type": "pron",
           "turkish_sentence": "Onu hiç kimse affetmedi.",
           "english_sentence": "Nobody pardoned him."
        },
        {
           "id": 144,
           "turkish_word": "fakat",
           "english_word": "but",
           "type": "conj",
           "turkish_sentence": "Ona yardım ederdim fakat çok yorgunum.",
           "english_sentence": "I would have helped him, but I am very tired."
        },
        {
           "id": 145,
           "turkish_word": "Avrupa",
           "english_word": "Europe",
           "type": "n",
           "turkish_sentence": "İstanbul’un yarısı Avrupa’dadır.",
           "english_sentence": "Half of Istanbul is in Europe."
        },
        {
           "id": 146,
           "turkish_word": "söz",
           "english_word": "word, saying",
           "type": "n",
           "turkish_sentence": "Her duyduğun söz e inanma.",
           "english_sentence": "Don’t believe every word you hear."
        },
        {
           "id": 147,
           "turkish_word": "burada",
           "english_word": "here",
           "type": "adv",
           "turkish_sentence": "Burada fazla kalamayız aslında.",
           "english_sentence": "Actually, we can’t stay here for very long."
        },
        {
           "id": 148,
           "turkish_word": "hakkında",
           "english_word": "about",
           "type": "adv",
           "turkish_sentence": "Yemek pişirmek hakkında fazla bilgim yok.",
           "english_sentence": "I do not know much about cooking."
        },
        {
           "id": 149,
           "turkish_word": "yaptığı",
           "english_word": "makes",
           "type": "ptcp",
           "turkish_sentence": "Annemin yaptığı kurabiyeler daha güzel.",
           "english_sentence": "The cookies my mother makes are nicer."
        },
        {
           "id": 150,
           "turkish_word": "konusunda",
           "english_word": "in the area of/about",
           "type": "adv",
           "turkish_sentence": "Matematik konusunda uzman birisidir.",
           "english_sentence": "She is an expert in the area of mathematics.",
           "notes": "the topic of"
        },
        {
           "id": 151,
           "turkish_word": "söyledi",
           "english_word": "he/she said",
           "type": "v",
           "turkish_sentence": "O, benzinimizin bittiğini söyledi.",
           "english_sentence": "He said that we are out of gas."
        },
        {
           "id": 152,
           "turkish_word": "bana",
           "english_word": "for me",
           "type": "pron",
           "turkish_sentence": "Ankara’dan bana güzel bir çanta almış.",
           "english_sentence": "She got a lovely bag for me from Ankara."
        },
        {
           "id": 153,
           "turkish_word": "-un",
           "english_word": "his/her",
           "type": "poss",
           "turkish_sentence": "Onun arabası hepimizi almaz.",
           "english_sentence": "His car will not hold all of us."
        },
        {
           "id": 154,
           "turkish_word": "kişi",
           "english_word": "body, person",
           "type": "n",
           "turkish_sentence": "Tercihler kişi ye göre değişir.",
           "english_sentence": "Every person has their own taste."
        },
        {
           "id": 155,
           "turkish_word": "eski",
           "english_word": "old",
           "type": "adj",
           "turkish_sentence": "Eski çamlar bardak oldu. (saying)",
           "english_sentence": "The old pines have turned into cups."
        },
        {
           "id": 156,
           "turkish_word": "biraz",
           "english_word": "some",
           "type": "adj",
           "turkish_sentence": "Hamura biraz su biraz da un katın.",
           "english_sentence": "Add some water and some flour to the dough."
        },
        {
           "id": 157,
           "turkish_word": "olsun",
           "english_word": "let it be",
           "type": "v",
           "turkish_sentence": "Bu oda harika, benim olsun.",
           "english_sentence": "This room is great, let it be mine."
        },
        {
           "id": 158,
           "turkish_word": "hemen",
           "english_word": "at once",
           "type": "adv",
           "turkish_sentence": "Hemen buraya gelmezsen çok kızarım!",
           "english_sentence": "If you don’t come here at once, I’ll be very mad!"
        },
        {
           "id": 159,
           "turkish_word": "mı",
           "english_word": "did",
           "type": "interr",
           "turkish_sentence": "Baban gerekli malzemeleri aldı mı ?",
           "english_sentence": "Did your father get the ingredients that I needed?"
        },
        {
           "id": 160,
           "turkish_word": "küçük",
           "english_word": "little",
           "type": "adj",
           "turkish_sentence": "Küçük bey sonunda uyanabildi!",
           "english_sentence": "The Little Lord has finally awoken!"
        },
        {
           "id": 161,
           "turkish_word": "belediye",
           "english_word": "city hall",
           "type": "n",
           "turkish_sentence": "Seni Belediye’ nin arkasında bekleyecekler.",
           "english_sentence": "They will wait for you behind City Hall."
        },
        {
           "id": 162,
           "turkish_word": "olacak",
           "english_word": "going to happen",
           "type": "adj",
           "turkish_sentence": "Ne olacak sa olsun artık dedim!",
           "english_sentence": "I said whatever’s going to happen should just happen!"
        },
        {
           "id": 163,
           "turkish_word": "kez",
           "english_word": "time",
           "type": "adv",
           "turkish_sentence": "İlk kez oluyor böyle bir şey.",
           "english_sentence": "This is the first time that something like this ever happened."
        },
        {
           "id": 164,
           "turkish_word": "bilgi",
           "english_word": "information",
           "type": "n",
           "turkish_sentence": "Yüzyılımızda bilgi ye ulaşmak artık daha kolay.",
           "english_sentence": "It is easier to reach information now in our century."
        },
        {
           "id": 165,
           "turkish_word": "ardından",
           "english_word": "after",
           "type": "postp",
           "turkish_sentence": "Gidenin ardından su atmak bizim adetimizdir.",
           "english_sentence": "It is our custom to spill water after someone leaves."
        },
        {
           "id": 166,
           "turkish_word": "su",
           "english_word": "water",
           "type": "n",
           "turkish_sentence": "Yeraltında su bulunduğunu öğrendiğimde çok şaşırmıştım.",
           "english_sentence": "I was amazed to learn that there was water underground. "
        },
        {
           "id": 167,
           "turkish_word": "işte",
           "english_word": "see",
           "type": "interj",
           "turkish_sentence": "İşte, gördün mü, seni geçtim!",
           "english_sentence": "See, I told you I would pass you!"
        },
        {
           "id": 168,
           "turkish_word": "ikinci",
           "english_word": "second",
           "type": "adj",
           "turkish_sentence": "Türkiye İkinci Dünya Savaşı’na katılmadı.",
           "english_sentence": "Turkey did not take part in the Second World War."
        },
        {
           "id": 169,
           "turkish_word": "sosyal",
           "english_word": "social",
           "type": "adj",
           "turkish_sentence": "O sosyal faaliyetlere katılmayı hiç sevmez.",
           "english_sentence": "He does not enjoy taking part in social activities."
        },
        {
           "id": 170,
           "turkish_word": "etmek",
           "english_word": "to do",
           "type": "v",
           "turkish_sentence": "İnsanlara iyilik etmek hoşuma gider.",
           "english_sentence": "I like to do good to people."
        },
        {
           "id": 171,
           "turkish_word": "zaten",
           "english_word": "anyway",
           "type": "adv",
           "turkish_sentence": "Zaten bugün çalışmayacaktık.",
           "english_sentence": "We weren’t going to work today anyway."
        },
        {
           "id": 172,
           "turkish_word": "birçok",
           "english_word": "many",
           "type": "adj",
           "turkish_sentence": "Birçok konuda onunla hemfikiriz.",
           "english_sentence": "We agree on many topics with him."
        },
        {
           "id": 173,
           "turkish_word": "pek",
           "english_word": "quite",
           "type": "adv",
           "turkish_sentence": "Bu pek önemli bir konu değil.",
           "english_sentence": "This is not quite an important topic."
        },
        {
           "id": 174,
           "turkish_word": "üç",
           "english_word": "three",
           "type": "num",
           "turkish_sentence": "Üç tane ördek yavrusu büyüttüm.",
           "english_sentence": "I raised three ducklings."
        },
        {
           "id": 175,
           "turkish_word": "an",
           "english_word": "remember",
           "type": "v",
           "turkish_sentence": "Eskileri an maktan bıktım.",
           "english_sentence": "I am sick of remembering the old days."
        },
        {
           "id": 176,
           "turkish_word": "-I",
           "english_word": "his/her",
           "type": "poss/suf",
           "turkish_sentence": "Onun masası kapının solundan altıncı.",
           "english_sentence": "His desk is the sixth one to the left of the door."
        },
        {
           "id": 177,
           "turkish_word": "yol",
           "english_word": "road",
           "type": "n",
           "turkish_sentence": "Yol dan geçen arabaları sayarak kendince eğleniyor.",
           "english_sentence": "She entertains herself by counting the cars passing by on the road."
        },
        {
           "id": 178,
           "turkish_word": "ABD",
           "english_word": "USA",
           "type": "n",
           "turkish_sentence": "Bu sene ABD ’ye tatile gitmek istiyoruz.",
           "english_sentence": "We want to go to the USA this year for a vacation."
        },
        {
           "id": 179,
           "turkish_word": "buna",
           "english_word": "",
           "type": "pron",
           "turkish_sentence": "Ben buna bir türlü inanamıyorum!",
           "english_sentence": "I just cannot believe this !",
           "notes": "to"
        },
        {
           "id": 180,
           "turkish_word": "yapan",
           "english_word": "maker",
           "type": "adj",
           "turkish_sentence": "O dolabı yapan kişiyi bulmak istiyorum.",
           "english_sentence": "I want to find the maker of that cupboard."
        },
        {
           "id": 181,
           "turkish_word": "değildir",
           "english_word": "is not",
           "type": "v",
           "turkish_sentence": "Bu bir yarış değildir.",
           "english_sentence": "This is not a competition."
        },
        {
           "id": 182,
           "turkish_word": "rağmen",
           "english_word": "despite",
           "type": "postp",
           "turkish_sentence": "Yardımlara rağmen yine de ayakta kalamadılar.",
           "english_sentence": "Despite all the help they got they could not survive."
        },
        {
           "id": 183,
           "turkish_word": "altında",
           "english_word": "under",
           "type": "postp",
           "turkish_sentence": "O katın altında yedi kat daha var.",
           "english_sentence": "There are seven more floors under this one."
        },
        {
           "id": 184,
           "turkish_word": "gün",
           "english_word": "day",
           "type": "n",
           "turkish_sentence": "Haydi bugün mükemmel bir gün geçirelim.",
           "english_sentence": "Let's have a perfect day today."
        },
        {
           "id": 185,
           "turkish_word": "hatta",
           "english_word": "in fact",
           "type": "adv",
           "turkish_sentence": "Ben gencim, hatta neredeyse çocuk sayılırım.",
           "english_sentence": "I am young, in fact I could be considered a child."
        },
        {
           "id": 186,
           "turkish_word": "aslında",
           "english_word": "actually",
           "type": "adv",
           "turkish_sentence": "Aslında o bizim ailemizden sayılır.",
           "english_sentence": "Actually, he could be considered part of our family."
        },
        {
           "id": 187,
           "turkish_word": "sağlık",
           "english_word": "health",
           "type": "n",
           "turkish_sentence": "Sağlık her şeyden önce gelir.",
           "english_sentence": "Health comes first."
        },
        {
           "id": 188,
           "turkish_word": "kısa",
           "english_word": "short",
           "type": "adj",
           "turkish_sentence": "Kısa bir hikaye yazdım.",
           "english_sentence": "I wrote a short story."
        },
        {
           "id": 189,
           "turkish_word": "öyle",
           "english_word": "that/so",
           "type": "adv",
           "turkish_sentence": "Öyle ya da böyle, bu iş yapılacak.",
           "english_sentence": "This way or that, the job must be done."
        },
        {
           "id": 190,
           "turkish_word": "şöyle",
           "english_word": "this way/like this",
           "type": "adv",
           "turkish_sentence": "Ona dişlerini şöyle fırçala dedim.",
           "english_sentence": "I told him to brush his teeth this way."
        },
        {
           "id": 191,
           "turkish_word": "-de",
           "english_word": "in his/her",
           "type": "poss/suf",
           "turkish_sentence": "Onun cebinde çok para var.",
           "english_sentence": "There is a lot of money in his pocket."
        },
        {
           "id": 192,
           "turkish_word": "ediyor",
           "english_word": "is doing",
           "type": "v",
           "turkish_sentence": "Dostum bana yardım etmek için çok gayret ediyor.",
           "english_sentence": "My friend is doing a lot to help me."
        },
        {
           "id": 193,
           "turkish_word": "geri",
           "english_word": "back; the past",
           "type": "adv",
           "turkish_sentence": "Geri dönmek mümkün müdür?",
           "english_sentence": "Is it possible to turn back ?"
        },
        {
           "id": 194,
           "turkish_word": "olsa",
           "english_word": "if only",
           "type": "adv",
           "turkish_sentence": "Kızımız da ev sahibi olsa seviniriz.",
           "english_sentence": "We would be happy if only our daughter had a house too."
        },
        {
           "id": 195,
           "turkish_word": "olabilir",
           "english_word": "possibly",
           "type": "adv",
           "turkish_sentence": "Onlar geç kalmış olabilir ler.",
           "english_sentence": "They could possibly be late."
        },
        {
           "id": 196,
           "turkish_word": "edilen",
           "english_word": "had been made",
           "type": "ptcp",
           "turkish_sentence": "Edilen bütün yeminler yalandı.",
           "english_sentence": "All the promises that had been made were false."
        },
        {
           "id": 197,
           "turkish_word": "saat",
           "english_word": "hour",
           "type": "n",
           "turkish_sentence": "Kaç saat sonra gelirsin?",
           "english_sentence": "How many hours later will you come?"
        },
        {
           "id": 198,
           "turkish_word": "süre",
           "english_word": "length",
           "type": "n",
           "turkish_sentence": "Gösteri için verdikleri süre çok fazlaydı.",
           "english_sentence": "The length of time they gave for the show was too long.",
           "notes": "of time"
        },
        {
           "id": 199,
           "turkish_word": "açık",
           "english_word": "open",
           "type": "adj",
           "turkish_sentence": "Ona her zaman açık çek veriyorlar.",
           "english_sentence": "They always give her an open check."
        },
        {
           "id": 200,
           "turkish_word": "yeniden",
           "english_word": "again; to restart",
           "type": "adv",
           "turkish_sentence": "Yeniden tatile gitmek için daha zaman var.",
           "english_sentence": "He still has some time before he can go on vacation again."
        },
        {
           "id": 201,
           "turkish_word": "milyon",
           "english_word": "million",
           "type": "n",
           "turkish_sentence": "Instagram’da kaç milyon takipçin var?",
           "english_sentence": "How many millions of followers do you have on Instagram?"
        },
        {
           "id": 202,
           "turkish_word": "ona",
           "english_word": "to him/her",
           "type": "adv",
           "turkish_sentence": "Ona her zaman her derdini anlatabilirsin.",
           "english_sentence": "You can always tell him/her about your troubles."
        },
        {
           "id": 203,
           "turkish_word": "ta",
           "english_word": "even until",
           "type": "prep",
           "turkish_sentence": "Ta sabaha kadar ders çalıştı.",
           "english_sentence": "She studied even until morning."
        },
        {
           "id": 204,
           "turkish_word": "hizmet",
           "english_word": "service",
           "type": "n",
           "turkish_sentence": "Bize çok iyi hizmet sundular.",
           "english_sentence": "They provided us with very good service."
        },
        {
           "id": 205,
           "turkish_word": "il",
           "english_word": "province",
           "type": "n",
           "turkish_sentence": "Türkiye’de seksen bir il var.",
           "english_sentence": "Turkey is divided into eighty-one provinces."
        },
        {
           "id": 206,
           "turkish_word": "hep",
           "english_word": "always",
           "type": "adv",
           "turkish_sentence": "Hep kafasının dikine gider.",
           "english_sentence": "She always goes her own way."
        },
        {
           "id": 207,
           "turkish_word": "zamanda",
           "english_word": "in time",
           "type": "adv",
           "turkish_sentence": "Zamanda yolculuk yapılabileceğine hep inandım.",
           "english_sentence": "I always believed that it is possible to travel in time."
        },
        {
           "id": 208,
           "turkish_word": "-da",
           "english_word": "in the",
           "type": "suf",
           "turkish_sentence": "Sonunda başarıya ulaştım.",
           "english_sentence": "I found success in the end."
        },
        {
           "id": 209,
           "turkish_word": "dikkat",
           "english_word": "attention",
           "type": "n",
           "turkish_sentence": "Dikkat etmeden yolu geçme.",
           "english_sentence": "Don’t cross the street without paying attention."
        },
        {
           "id": 210,
           "turkish_word": "geldi",
           "english_word": "came",
           "type": "v",
           "turkish_sentence": "Bugün amcam evimize geldi.",
           "english_sentence": "My uncle came to our house today."
        },
        {
           "id": 211,
           "turkish_word": "ay",
           "english_word": "moon; a month",
           "type": "n",
           "turkish_sentence": "Ay bu gece çok parlak görünüyor.",
           "english_sentence": "The moon looks very bright tonight."
        },
        {
           "id": 212,
           "turkish_word": "belki",
           "english_word": "might",
           "type": "interj",
           "turkish_sentence": "Belki yarın pikniğe gideriz.",
           "english_sentence": "We might go on a picnic tomorrow."
        },
        {
           "id": 213,
           "turkish_word": "parti",
           "english_word": "party",
           "type": "n",
           "turkish_sentence": "Yılbaşı parti sine gidelim mi?",
           "english_sentence": "Shall we go to the New Year’s party ?"
        },
        {
           "id": 214,
           "turkish_word": "kadın",
           "english_word": "woman",
           "type": "n",
           "turkish_sentence": "Kadın olmak hem güzel hem de zordur.",
           "english_sentence": "It is both nice and hard to be a woman."
        },
        {
           "id": 215,
           "turkish_word": "karar",
           "english_word": "decision",
           "type": "n",
           "turkish_sentence": "Karar vermeden önce çok düşündüm.",
           "english_sentence": "I thought a lot before making a decision."
        },
        {
           "id": 216,
           "turkish_word": "gerek",
           "english_word": "need",
           "type": "n",
           "turkish_sentence": "Gerek yoktu pasta almanıza.",
           "english_sentence": "There was no need for you to get a cake."
        },
        {
           "id": 217,
           "turkish_word": "nedeniyle",
           "english_word": "due to",
           "type": "postp",
           "turkish_sentence": "Tadilat nedeniyle kapalıyız.",
           "english_sentence": "We are closed due to construction."
        },
        {
           "id": 218,
           "turkish_word": "beni",
           "english_word": "me",
           "type": "pron",
           "turkish_sentence": "Beni anlamıyorlar!",
           "english_sentence": "They don’t understand me !"
        },
        {
           "id": 219,
           "turkish_word": "insanlar",
           "english_word": "people",
           "type": "n",
           "turkish_sentence": "İnsanlar arasında bazen kavgalar olur.",
           "english_sentence": "People sometimes quarrel."
        },
        {
           "id": 220,
           "turkish_word": "yakın",
           "english_word": "near",
           "type": "n",
           "turkish_sentence": "Uzak ya da yakın fark etmez.",
           "english_sentence": "It doesn’t matter whether it is near or far."
        },
        {
           "id": 221,
           "turkish_word": "milli",
           "english_word": "national",
           "type": "adj",
           "turkish_sentence": "Milli marşımızı çok seviyorum.",
           "english_sentence": "I like our national anthem very much."
        },
        {
           "id": 222,
           "turkish_word": "içerisinde",
           "english_word": "in it, inside",
           "type": "prep/postp",
           "turkish_sentence": "İçerisinde eşya olan bir ev tutmak ıstıyoruz.",
           "english_sentence": "We want to rent a house that has furniture in it."
        },
        {
           "id": 223,
           "turkish_word": "bağlı",
           "english_word": "attached ; dependant",
           "type": "adj",
           "turkish_sentence": "Zincir salıncağa bağlı.",
           "english_sentence": "The chain is attached to the swing."
        },
        {
           "id": 224,
           "turkish_word": "of",
           "english_word": "oh",
           "type": "interj",
           "turkish_sentence": "Of, çok sıkıldım bunu dinlemekten!",
           "english_sentence": "Oh, I’m so bored listening to this!"
        },
        {
           "id": 225,
           "turkish_word": "olup",
           "english_word": "whether",
           "type": "ptcp",
           "turkish_sentence": "Evli olup olmadığımı sordu.",
           "english_sentence": "She asked whether I was married or not."
        },
        {
           "id": 226,
           "turkish_word": "gerçek",
           "english_word": "truth",
           "type": "n",
           "turkish_sentence": "Gerçek ortaya çıkmalı.",
           "english_sentence": "The truth should be revealed."
        },
        {
           "id": 227,
           "turkish_word": "bize",
           "english_word": "to us",
           "type": "adv",
           "turkish_sentence": "Bize yedek anahtar takımı verdi.",
           "english_sentence": "She gave a set of spare keys to us."
        },
        {
           "id": 228,
           "turkish_word": "olmayan",
           "english_word": "without",
           "type": "ptcp",
           "turkish_sentence": "Bileti olmayan giremez.",
           "english_sentence": "Those without tickets cannot enter."
        },
        {
           "id": 229,
           "turkish_word": "mümkün",
           "english_word": "possible",
           "type": "adj",
           "turkish_sentence": "Mümkün olsaydı aya bile giderdi.",
           "english_sentence": "If it were possible, she would even go to the moon."
        },
        {
           "id": 230,
           "turkish_word": "tekrar",
           "english_word": "again",
           "type": "adv",
           "turkish_sentence": "Tekrar buraya yerleşmeye karar verdik.",
           "english_sentence": "We have decided to settle here again."
        },
        {
           "id": 231,
           "turkish_word": "başladı",
           "english_word": "started",
           "type": "v",
           "turkish_sentence": "Gösteri başladı, lütfen sessiz olun.",
           "english_sentence": "The show has started, please be quiet."
        },
        {
           "id": 232,
           "turkish_word": "Ankara",
           "english_word": "Ankara",
           "type": "n",
           "turkish_sentence": "Ankara ülkemizin başkentidir.",
           "english_sentence": "Ankara is our country’s capital."
        },
        {
           "id": 233,
           "turkish_word": "çocuk",
           "english_word": "child",
           "type": "n",
           "turkish_sentence": "Çocuk denecek yaşta çalışmaya başlamış.",
           "english_sentence": "He started working when he was merely a child."
        },
        {
           "id": 234,
           "turkish_word": "gereken",
           "english_word": "needed",
           "type": "ptcp",
           "turkish_sentence": "Gereken ilgiyi gösteremediler ona.",
           "english_sentence": "They could not give him the attention he needed."
        },
        {
           "id": 235,
           "turkish_word": "konusu",
           "english_word": "…’s topic",
           "type": "n",
           "turkish_sentence": "Kitabın konusu çok tuhaftı.",
           "english_sentence": "The book’s topic was very strange."
        },
        {
           "id": 236,
           "turkish_word": "konuda",
           "english_word": "about this topic",
           "type": "adv",
           "turkish_sentence": "Bu konuda epeyce bilgim var.",
           "english_sentence": "I have quite a lot of knowledge about this topic."
        },
        {
           "id": 237,
           "turkish_word": "vardı",
           "english_word": "had; existed; there was/were",
           "type": "v",
           "turkish_sentence": "Üzerinde elbisesi vardı ama ayağında ayakkabısı yoktu.",
           "english_sentence": "He had clothes on him but he didn’t have any shoes on his feet."
        },
        {
           "id": 238,
           "turkish_word": "para",
           "english_word": "money",
           "type": "n",
           "turkish_sentence": "Birçok yere para dolu kutular saklamış.",
           "english_sentence": "She has hidden boxes full of money in many places."
        },
        {
           "id": 239,
           "turkish_word": "kurulu",
           "english_word": "preassembled",
           "type": "adj",
           "turkish_sentence": "Kurulu bir dolap almışlar.",
           "english_sentence": "They got a preassembled cupboard."
        },
        {
           "id": 240,
           "turkish_word": "anda",
           "english_word": "the instant",
           "type": "n",
           "turkish_sentence": "Onun geldiği anda bando çalmaya başlamış.",
           "english_sentence": "The band started playing the instant he arrived."
        },
        {
           "id": 241,
           "turkish_word": "hafta",
           "english_word": "week",
           "type": "n",
           "turkish_sentence": "Hafta ya okul açılacak.",
           "english_sentence": "School will start next week."
        },
        {
           "id": 242,
           "turkish_word": "-de/-te",
           "english_word": "in",
           "type": "suf",
           "turkish_sentence": "Sepette üç elma var.",
           "english_sentence": "There are three apples in the basket."
        },
        {
           "id": 243,
           "turkish_word": "yönetim",
           "english_word": "the administration",
           "type": "n",
           "turkish_sentence": "Yönetim böyle karar vermiş.",
           "english_sentence": "The administration has decided so."
        },
        {
           "id": 244,
           "turkish_word": "-a/-e",
           "english_word": "for",
           "type": "suf",
           "turkish_sentence": "Oğluna çok güzel bir beşik yaptırmış.",
           "english_sentence": "He has had a very nice crib made for his son."
        },
        {
           "id": 245,
           "turkish_word": "bundan",
           "english_word": "from/from this moment",
           "type": "adv",
           "turkish_sentence": "Bundan böyle bana anne deyin.",
           "english_sentence": "From now on call me mother."
        },
        {
           "id": 246,
           "turkish_word": "bunlar",
           "english_word": "they; these",
           "type": "pron",
           "turkish_sentence": "Bunlar kadar çalışkan öğrenci görmedim.",
           "english_sentence": "I have not seen such hardworking students as they are."
        },
        {
           "id": 247,
           "turkish_word": "durum",
           "english_word": "situation",
           "type": "n",
           "turkish_sentence": "Durum çok da fena değil.",
           "english_sentence": "The situation is not so bad."
        },
        {
           "id": 248,
           "turkish_word": "size",
           "english_word": "for you",
           "type": "pron",
           "turkish_sentence": "Size göre bir dairemiz yok maalesef.",
           "english_sentence": "Unfortunately, we do not have a suitable apartment for you."
        },
        {
           "id": 249,
           "turkish_word": "Dr.",
           "english_word": "Doctor",
           "type": "n",
           "turkish_sentence": "Dr. Remzi sizi az sonra görecek.",
           "english_sentence": "Doctor Remzi will see you soon."
        },
        {
           "id": 250,
           "turkish_word": "-i",
           "english_word": "the",
           "type": "suf",
           "turkish_sentence": "Silgiyi her gün kaybediyor.",
           "english_sentence": "She loses the eraser every day."
        },
        {
           "id": 251,
           "turkish_word": "dışında",
           "english_word": "outside",
           "type": "adv",
           "turkish_sentence": "Köpeği evin dışında tutuyor.",
           "english_sentence": "She keeps the dog outside the house."
        },
        {
           "id": 252,
           "turkish_word": "dolayı",
           "english_word": "because",
           "type": "adv",
           "turkish_sentence": "Senden dolayı eve gelmiyorum.",
           "english_sentence": "I don’t come home because of you."
        },
        {
           "id": 253,
           "turkish_word": "-daki",
           "english_word": "on the",
           "type": "suf",
           "turkish_sentence": "Duvardaki lekeler çıkmıyor.",
           "english_sentence": "The stains on the wall cannot be wiped off."
        },
        {
           "id": 254,
           "turkish_word": "çıkan",
           "english_word": "came up",
           "type": "ptcp",
           "turkish_sentence": "Merdivenden çıkan kişi benim babammış.",
           "english_sentence": "The person who came up the stairs was my father."
        },
        {
           "id": 255,
           "turkish_word": "destek",
           "english_word": "support",
           "type": "n",
           "turkish_sentence": "Bize destek olsun diye seyretmeye gelmiş.",
           "english_sentence": "He came to support us by being in the audience."
        },
        {
           "id": 256,
           "turkish_word": "elde",
           "english_word": "what we had",
           "type": "adj",
           "turkish_sentence": "Elde ne varsa sattık.",
           "english_sentence": "We sold what we had."
        },
        {
           "id": 257,
           "turkish_word": "çeşitli",
           "english_word": "various",
           "type": "adj",
           "turkish_sentence": "Çeşitli örnekler vererek konuyu anlatır.",
           "english_sentence": "He explains the topic by giving various examples."
        },
        {
           "id": 258,
           "turkish_word": "temel",
           "english_word": "foundation",
           "type": "n",
           "turkish_sentence": "Evin temel i çok derin kazılmış.",
           "english_sentence": "The house’s foundation was dug very deep."
        },
        {
           "id": 259,
           "turkish_word": "başkan",
           "english_word": "head",
           "type": "n",
           "turkish_sentence": "Her şeyin başkan ı olmaya pek meraklıdır.",
           "english_sentence": "She is so eager to be the head of everything."
        },
        {
           "id": 260,
           "turkish_word": "merkez",
           "english_word": "center",
           "type": "n",
           "turkish_sentence": "Dünyanın merkez i ayağımın altıdır.",
           "english_sentence": "The center of the world is under my foot."
        },
        {
           "id": 261,
           "turkish_word": "genç",
           "english_word": "young",
           "type": "adj",
           "turkish_sentence": "Adam genç bir eşek almak istemiş.",
           "english_sentence": "The man wanted to get a young donkey."
        },
        {
           "id": 262,
           "turkish_word": "hangi",
           "english_word": "whichever",
           "type": "adj",
           "turkish_sentence": "Hangi yöne baksam yıldızları görüyordum.",
           "english_sentence": "Whichever way I turned I could see the stars."
        },
        {
           "id": 263,
           "turkish_word": "zor",
           "english_word": "difficult",
           "type": "adj",
           "turkish_sentence": "Zor bir ödev verdim ki beyinlerini biraz çalıştırsınlar.",
           "english_sentence": "I gave them a difficult task as homework so they would use their brains a little."
        },
        {
           "id": 264,
           "turkish_word": "yönelik",
           "english_word": "facing",
           "type": "adv",
           "turkish_sentence": "Güneşe yönelik duran o çiçekler ne hoş!",
           "english_sentence": "How lovely are those flowers facing the sun!"
        },
        {
           "id": 265,
           "turkish_word": "çalışma",
           "english_word": "study ; work",
           "type": "n",
           "turkish_sentence": "Çalışma alışkanlığını edinmiş öğrenciler nasıl başarılı olmaz!",
           "english_sentence": "How could students who have acquired good study habits not be successful!"
        },
        {
           "id": 266,
           "turkish_word": "Ali",
           "english_word": "Ali",
           "type": "n",
           "turkish_sentence": "Benim babamın adı Ali.",
           "english_sentence": "My father’s name is Ali.",
           "notes": "masculine name"
        },
        {
           "id": 267,
           "turkish_word": "siz",
           "english_word": "you",
           "type": "n pl",
           "turkish_sentence": "Siz neden pazara geç geldiniz?",
           "english_sentence": "Why were you late to the bazaar?"
        },
        {
           "id": 268,
           "turkish_word": "belli",
           "english_word": "clear",
           "type": "adv",
           "turkish_sentence": "Akşam olduğu gölgelerden belli oluyor.",
           "english_sentence": "It is clear that it is evening by looking at the shadows."
        },
        {
           "id": 269,
           "turkish_word": "sen",
           "english_word": "you",
           "type": "pron",
           "turkish_sentence": "Sen sonradan gelebilirsin.",
           "english_sentence": "You can come later."
        },
        {
           "id": 270,
           "turkish_word": "ekonomik",
           "english_word": "economical",
           "type": "adj",
           "turkish_sentence": "Ekonomik çabalar olmasa ülke iflas ederdi.",
           "english_sentence": "If it wasn’t for the economical efforts the country would go bankrupt."
        },
        {
           "id": 271,
           "turkish_word": "ait",
           "english_word": "belong",
           "type": "adj",
           "turkish_sentence": "Kendimi kesinlikle buraya ait hissetmiyorum.",
           "english_sentence": "I definitely don’t feel like I belong here."
        },
        {
           "id": 272,
           "turkish_word": "veren",
           "english_word": "who gives",
           "type": "ptcp",
           "turkish_sentence": "Genelde bize çay veren adam bugün gelmedi.",
           "english_sentence": "The man who usually gives us tea did not come today."
        },
        {
           "id": 273,
           "turkish_word": "yaklaşık",
           "english_word": "about",
           "type": "adj",
           "turkish_sentence": "Yaklaşık dört saat sonra ilacımı alacağım.",
           "english_sentence": "I will take my pills in about four hours."
        },
        {
           "id": 274,
           "turkish_word": "yapmak",
           "english_word": "to do",
           "type": "v",
           "turkish_sentence": "Yoga yapmak için bir halı aldı.",
           "english_sentence": "She got a mat to do yoga on."
        },
        {
           "id": 275,
           "turkish_word": "gerçekten",
           "english_word": "really",
           "type": "adv",
           "turkish_sentence": "İnanamıyorum, gerçekten elli yaşına mı gelmişim!",
           "english_sentence": "Have I really turned fifty, I can’t believe it!"
        },
        {
           "id": 276,
           "turkish_word": "eder",
           "english_word": "go for",
           "type": "v",
           "turkish_sentence": "Bu motor kaç para eder ?",
           "english_sentence": "How much would this motorcycle go for ?"
        },
        {
           "id": 277,
           "turkish_word": "oldukça",
           "english_word": "quite",
           "type": "adj",
           "turkish_sentence": "Oldukça büyük bir duvar o, üstünden tırmanamam.",
           "english_sentence": "That is quite a big wall, I can’t climb over it."
        },
        {
           "id": 278,
           "turkish_word": "herhangi",
           "english_word": "any",
           "type": "adj",
           "turkish_sentence": "Herhangi bir haber duyarsan bize haber ver.",
           "english_sentence": "If you hear any news please let us know."
        },
        {
           "id": 279,
           "turkish_word": "bi’",
           "english_word": "some",
           "type": "abbr",
           "turkish_sentence": "Abi, bi’ ekmek parası versene!",
           "english_sentence": "Bro, please give me some money for food!",
           "notes": "abbreviation of one “bir”"
        },
        {
           "id": 280,
           "turkish_word": "konu",
           "english_word": "topic",
           "type": "n",
           "turkish_sentence": "Bu konu da konuşmak istemiyorum.",
           "english_sentence": "I do not want to talk about this topic."
        },
        {
           "id": 281,
           "turkish_word": "kendisi ni",
           "english_word": "himself/herself",
           "type": "pron",
           "turkish_sentence": "Kendisini gereğinden fazla seviyor.",
           "english_sentence": "He loves himself more than necessary."
        },
        {
           "id": 282,
           "turkish_word": "gerekir",
           "english_word": "should be",
           "type": "v",
           "turkish_sentence": "“Böyle olması gerekir,” dedi.",
           "english_sentence": "He said that it should be this way."
        },
        {
           "id": 283,
           "turkish_word": "gelir",
           "english_word": "comes",
           "type": "v",
           "turkish_sentence": "Her gün gelir, dersini verir.",
           "english_sentence": "He comes each day and gives a lecture."
        },
        {
           "id": 284,
           "turkish_word": "kötü",
           "english_word": "bad",
           "type": "adj",
           "turkish_sentence": "Bence durum o kadar da kötü değil.",
           "english_sentence": "I don’t think the situation is that bad."
        },
        {
           "id": 285,
           "turkish_word": "oluyor",
           "english_word": "happens",
           "type": "v",
           "turkish_sentence": "Hep onun öngördüğü oluyor.",
           "english_sentence": "Whatever she says happens."
        },
        {
           "id": 286,
           "turkish_word": "tarih",
           "english_word": "history",
           "type": "n",
           "turkish_sentence": "Türk tarih ini öğreniyorum.",
           "english_sentence": "I am learning about Turkish history."
        },
        {
           "id": 287,
           "turkish_word": "sürekli",
           "english_word": "always",
           "type": "adv",
           "turkish_sentence": "O sürekli kavga çıkaran bir çocuktur.",
           "english_sentence": "That child always picks a fight."
        },
        {
           "id": 288,
           "turkish_word": "insanların",
           "english_word": "the people’s",
           "type": "n",
           "turkish_sentence": "İnsanların yanında evcil hayvanları da vardı.",
           "english_sentence": "The people’s pets were with them."
        },
        {
           "id": 289,
           "turkish_word": "siyasi",
           "english_word": "political",
           "type": "adj",
           "turkish_sentence": "Ben siyasi işlere karışmayı sevmem.",
           "english_sentence": "I do not like to be involved in political events."
        },
        {
           "id": 290,
           "turkish_word": "sonunda",
           "english_word": "at the end",
           "type": "adv",
           "turkish_sentence": "Konserin sonunda fazladan bir gösteri yaptılar.",
           "english_sentence": "They performed another show at the end of the concert."
        },
        {
           "id": 291,
           "turkish_word": "türlü",
           "english_word": "sort",
           "type": "adj",
           "turkish_sentence": "Her türlü yolu denedik ama nafile.",
           "english_sentence": "We tried every sort of way, but we had no luck."
        },
        {
           "id": 292,
           "turkish_word": "verdi",
           "english_word": "he/she gave",
           "type": "v",
           "turkish_sentence": "Ona en fazla bulunan balıklardan verdi.",
           "english_sentence": "He gave her some of the fish that were plentiful."
        },
        {
           "id": 293,
           "turkish_word": "Mehmet",
           "english_word": "Mehmet",
           "type": "n",
           "turkish_sentence": "Benim en iyi arkadaşım Mehmet.",
           "english_sentence": "Mehmet is my best friend.",
           "notes": "masculine name"
        },
        {
           "id": 294,
           "turkish_word": "ad",
           "english_word": "name",
           "type": "n",
           "turkish_sentence": "Onun ad ı kapıda yazılıymış.",
           "english_sentence": "His name is on the door."
        },
        {
           "id": 295,
           "turkish_word": "birkaç",
           "english_word": "a few",
           "type": "adj",
           "turkish_sentence": "Birkaç adım attıktan sonra bayıldı.",
           "english_sentence": "He fainted after taking a few steps."
        },
        {
           "id": 296,
           "turkish_word": "ayrı",
           "english_word": "special",
           "type": "adj",
           "turkish_sentence": "Onun yeri ayrı dır bende.",
           "english_sentence": "She has a special place in my heart."
        },
        {
           "id": 297,
           "turkish_word": "haber",
           "english_word": "news",
           "type": "n",
           "turkish_sentence": "Annemden haber gelince hemen Ankara’ya gittim.",
           "english_sentence": "After I got news from my mother, I immediately went to Ankara."
        },
        {
           "id": 298,
           "turkish_word": "onlar",
           "english_word": "they",
           "type": "pron",
           "turkish_sentence": "Onlar benden önce yatmışlar.",
           "english_sentence": "They went to bed before me."
        },
        {
           "id": 299,
           "turkish_word": "ana",
           "english_word": "mother ; main",
           "type": "n",
           "turkish_sentence": "Kedi ana olduktan sonra bize karşı değişti.",
           "english_sentence": "The cat’s attitude changed when she became a mother."
        },
        {
           "id": 300,
           "turkish_word": "yanında",
           "english_word": "next to",
           "type": "postp",
           "turkish_sentence": "Bekçinin yanında gezen kişi kim?",
           "english_sentence": "Who is the person walking next to the guard?"
        },
        {
           "id": 301,
           "turkish_word": "durum",
           "english_word": "situation",
           "type": "n",
           "turkish_sentence": "Durum da değişiklik olursa size haber veririz.",
           "english_sentence": "If there is a change in the situation we will let you know."
        },
        {
           "id": 302,
           "turkish_word": "göz",
           "english_word": "eye",
           "type": "n",
           "turkish_sentence": "Göz üyle ilgili bir sorun varmış.",
           "english_sentence": "He has a problem with his eye."
        },
        {
           "id": 303,
           "turkish_word": "teknik",
           "english_word": "technical",
           "type": "adj",
           "turkish_sentence": "Teknik meselelerden pek anlamam.",
           "english_sentence": "I do not really understand technical issues."
        },
        {
           "id": 304,
           "turkish_word": "ettiği",
           "english_word": "he/she makes",
           "type": "ptcp",
           "turkish_sentence": "Arkadaşının ettiği gürültüyü çekemiyor.",
           "english_sentence": "She can’t take the noise her friend makes."
        },
        {
           "id": 305,
           "turkish_word": "içinde",
           "english_word": "inside",
           "type": "adj",
           "turkish_sentence": "Çantanın içinde astar yokmuş.",
           "english_sentence": "There is no lining inside the bag."
        },
        {
           "id": 306,
           "turkish_word": "açısından",
           "english_word": "in terms of",
           "type": "postp",
           "turkish_sentence": "O kadının açısından olaya bakabiliyor musun?",
           "english_sentence": "Can you see it in terms of that woman’s perspective?"
        },
        {
           "id": 307,
           "turkish_word": "herkes",
           "english_word": "everybody",
           "type": "n",
           "turkish_sentence": "Yeni çifte herkes yardım etti.",
           "english_sentence": "Everybody helped the newly wed couple."
        },
        {
           "id": 308,
           "turkish_word": "sahibi",
           "english_word": "the owner of",
           "type": "n",
           "turkish_sentence": "Köpeğin sahibi koşarak geldi.",
           "english_sentence": "The owner of the dog came running."
        },
        {
           "id": 309,
           "turkish_word": "hareket",
           "english_word": "action",
           "type": "n",
           "turkish_sentence": "Nerede hareket orada bereket.",
           "english_sentence": "Wherever there’s action, there’s abundance."
        },
        {
           "id": 310,
           "turkish_word": "dünyanın",
           "english_word": "the world’s",
           "type": "n",
           "turkish_sentence": "Dünyanın en yüksek zirvesi Everest Dağı’ndadır.",
           "english_sentence": "The world’s highest mountain peak is Mount Everest."
        },
        {
           "id": 311,
           "turkish_word": "a",
           "english_word": "oh",
           "type": "interj",
           "turkish_sentence": "A, şuna bak, elbisesini ters giymiş!",
           "english_sentence": "Oh, look at her, she has her dress on inside out!"
        },
        {
           "id": 312,
           "turkish_word": "arada",
           "english_word": "sometimes",
           "type": "adv",
           "turkish_sentence": "Ona arada böyle mesajlar geliyor.",
           "english_sentence": "He sometimes gets messages like these."
        },
        {
           "id": 313,
           "turkish_word": "üniversite",
           "english_word": "university",
           "type": "n",
           "turkish_sentence": "Marmara Üniversite si yeni fakülte açacakmış.",
           "english_sentence": "Marmara University will add a new department this year."
        },
        {
           "id": 314,
           "turkish_word": "gerekli",
           "english_word": "crucial",
           "type": "adj",
           "turkish_sentence": "Herkes için gerekli aletler satıyormuş.",
           "english_sentence": "He sells gadgets that are crucial for everybody."
        },
        {
           "id": 315,
           "turkish_word": "halk",
           "english_word": "people",
           "type": "n",
           "turkish_sentence": "Halk arasında hikayeler üretilmiş.",
           "english_sentence": "People have come up with stories amongst themselves."
        },
        {
           "id": 316,
           "turkish_word": "boyunca",
           "english_word": "along",
           "type": "adv",
           "turkish_sentence": "Sahil boyunca uzanan bir arsası var.",
           "english_sentence": "He has land that stretches along the coast."
        },
        {
           "id": 317,
           "turkish_word": "ülke",
           "english_word": "country",
           "type": "n",
           "turkish_sentence": "Bulgaristan Türkiye’ye komşu olan bir ülke dir.",
           "english_sentence": "Bulgaristan is a neighbouring country to Turkey."
        },
        {
           "id": 318,
           "turkish_word": "CHP",
           "english_word": "Republican People’s Party",
           "type": "n",
           "turkish_sentence": "CHP ilk kurulan Türk politik partisidir.",
           "english_sentence": "The Republican People’s Party was the first Turkish political party."
        },
        {
           "id": 319,
           "turkish_word": "-u",
           "english_word": "his/her",
           "type": "pos",
           "turkish_sentence": "Burnu nu estetik yaptırmış.",
           "english_sentence": "She had her nose done."
        },
        {
           "id": 320,
           "turkish_word": "adam",
           "english_word": "man, person",
           "type": "n",
           "turkish_sentence": "O adam yine gelmiş.",
           "english_sentence": "That man came again."
        },
        {
           "id": 321,
           "turkish_word": "TL",
           "english_word": "Turkish liras",
           "type": "n",
           "turkish_sentence": "Size kaç TL ödedi?",
           "english_sentence": "How many Turkish liras did he pay you?"
        },
        {
           "id": 322,
           "turkish_word": "sizin",
           "english_word": "your",
           "type": "pron",
           "turkish_sentence": "Sizin doğum gününüz ne zaman?",
           "english_sentence": "When is your birthday?"
        },
        {
           "id": 323,
           "turkish_word": "onların",
           "english_word": "their",
           "type": "pron",
           "turkish_sentence": "Onların evi satılık değil.",
           "english_sentence": "Their house is not for sale."
        },
        {
           "id": 324,
           "turkish_word": "el",
           "english_word": "hand",
           "type": "n",
           "turkish_sentence": "El ele verirsek bu iş çabuk biter.",
           "english_sentence": "If we work hand in hand this job will get done quickly."
        },
        {
           "id": 325,
           "turkish_word": "adına",
           "english_word": "in her name",
           "type": "adv",
           "turkish_sentence": "Babası onun adına konuşur hep.",
           "english_sentence": "Her dad always talks in her name."
        },
        {
           "id": 326,
           "turkish_word": "ederek",
           "english_word": "doing",
           "type": "ptcp",
           "turkish_sentence": "Özel bir dans ederek sahneden indi.",
           "english_sentence": "She exited the stage doing a special dance."
        },
        {
           "id": 327,
           "turkish_word": "evet",
           "english_word": "yes",
           "type": "interj",
           "turkish_sentence": "Her şeye evet dersen işin zor!",
           "english_sentence": "If you say yes to everything, you’ll have difficulty."
        },
        {
           "id": 328,
           "turkish_word": "spor",
           "english_word": "sports",
           "type": "n",
           "turkish_sentence": "Okulda en sevdiği ders spor.",
           "english_sentence": "His favorite thing at school is sports."
        },
        {
           "id": 329,
           "turkish_word": "yoktur",
           "english_word": "is no",
           "type": "v",
           "turkish_sentence": "Bu işin çaresi yoktur.",
           "english_sentence": "There is no solution to this problem."
        },
        {
           "id": 330,
           "turkish_word": "kolay",
           "english_word": "easy",
           "type": "adj",
           "turkish_sentence": "Sınavda kolay soru sorar.",
           "english_sentence": "He asks easy questions on the exam."
        },
        {
           "id": 331,
           "turkish_word": "ve",
           "english_word": "and",
           "type": "conj",
           "turkish_sentence": "Pilav ve fasülye birbirine çok yakışır.",
           "english_sentence": "Rice and beans go hand in hand."
        },
        {
           "id": 332,
           "turkish_word": "sıra",
           "english_word": "turn",
           "type": "n",
           "turkish_sentence": "Bize sıra nın gelmesi on dakika sürer.",
           "english_sentence": "It will be ten minutes before our turn comes."
        },
        {
           "id": 333,
           "turkish_word": "-deki",
           "english_word": "on the",
           "type": "suf",
           "turkish_sentence": "Perdedeki lekeyi çıkaramadım.",
           "english_sentence": "I couldn’t clean the spot on the curtain."
        },
        {
           "id": 334,
           "turkish_word": "internet",
           "english_word": "internet",
           "type": "n",
           "turkish_sentence": "Bu kafedeki internet bağlantısı çok zayıf.",
           "english_sentence": "The internet speed at this café is very low."
        },
        {
           "id": 335,
           "turkish_word": "kültür",
           "english_word": "culture",
           "type": "n",
           "turkish_sentence": "Türk kültür ünü anlamaya çalışıyorum.",
           "english_sentence": "I am trying to understand Turkish culture."
        },
        {
           "id": 336,
           "turkish_word": "başarılı",
           "english_word": "successful",
           "type": "adv",
           "turkish_sentence": "O yazarı çok başarılı buluyorum.",
           "english_sentence": "I think that writer is very successful."
        },
        {
           "id": 337,
           "turkish_word": "uluslararası",
           "english_word": "international",
           "type": "adj",
           "turkish_sentence": "Uluslararası bir şirkette calışıyor.",
           "english_sentence": "She works for an international company."
        },
        {
           "id": 338,
           "turkish_word": "ortak",
           "english_word": "similar",
           "type": "adj",
           "turkish_sentence": "Ortak zevklerimiz var.",
           "english_sentence": "We have similar tastes."
        },
        {
           "id": 339,
           "turkish_word": "neden",
           "english_word": "reason",
           "type": "n",
           "turkish_sentence": "Bu neden le senin takıma girmene izin vermediler.",
           "english_sentence": "This is the reason why they didn’t let you join the team."
        },
        {
           "id": 340,
           "turkish_word": "tür",
           "english_word": "variety/sort of",
           "type": "adj",
           "turkish_sentence": "Bu tür ağaçları dikmeyin dediler.",
           "english_sentence": "They said not to plant this variety of trees."
        },
        {
           "id": 341,
           "turkish_word": "bu hal",
           "english_word": "this state",
           "type": "n",
           "turkish_sentence": "Çocuklar evi bu hal e sokup gitmişler!",
           "english_sentence": "The kids left the house in this state !"
        },
        {
           "id": 342,
           "turkish_word": "-in",
           "english_word": "your",
           "type": "pos",
           "turkish_sentence": "Kalemin benim cebimde.",
           "english_sentence": "Your pencil is in my pocket."
        },
        {
           "id": 343,
           "turkish_word": "Sayın",
           "english_word": "Mr/Mrs",
           "type": "n",
           "turkish_sentence": "Sayın Vali konuşma yapacak.",
           "english_sentence": "Mr. Governor is going to give a speech."
        },
        {
           "id": 344,
           "turkish_word": "üst",
           "english_word": "top, higher",
           "type": "adj",
           "turkish_sentence": "Üst seviyede bir futbolcudur o.",
           "english_sentence": "He is a top football player."
        },
        {
           "id": 345,
           "turkish_word": "kurşun",
           "english_word": "bullet",
           "type": "n",
           "turkish_sentence": "Araba kurşun izleriyle doluydu.",
           "english_sentence": "The car was covered with bullet holes."
        },
        {
           "id": 346,
           "turkish_word": "yakışıklı",
           "english_word": "handsome",
           "type": "adj",
           "turkish_sentence": "Sen şimdiye kadar gördüğüm en yakışıklı adamsın.",
           "english_sentence": "You’re the most handsome man I’ve ever seen."
        },
        {
           "id": 347,
           "turkish_word": "konuştu",
           "english_word": "talked",
           "type": "v",
           "turkish_sentence": "Ali küresel ısınma hakkında konuştu.",
           "english_sentence": "Ali talked about global warming."
        },
        {
           "id": 348,
           "turkish_word": "cevap",
           "english_word": "answer",
           "type": "n",
           "turkish_sentence": "Bu cevap doğru değil.",
           "english_sentence": "This answer is not correct."
        },
        {
           "id": 349,
           "turkish_word": "yerde",
           "english_word": "on the ground",
           "type": "adv",
           "turkish_sentence": "Bunu yerde buldum.",
           "english_sentence": "I found this on the ground."
        },
        {
           "id": 350,
           "turkish_word": "yaptı",
           "english_word": "did/made",
           "type": "v",
           "turkish_sentence": "Bu keki annesiyle beraber yaptı.",
           "english_sentence": "He made this cake with his mother."
        },
        {
           "id": 351,
           "turkish_word": "ciddi",
           "english_word": "serious",
           "type": "adj",
           "turkish_sentence": "Ciddi misin?",
           "english_sentence": "Are you serious ?"
        },
        {
           "id": 352,
           "turkish_word": "verilen",
           "english_word": "given",
           "type": "ptcp",
           "turkish_sentence": "Bilgisayar adı verilen bu cihaz hepimizin hayatında büyük bir öneme sahip olmaya başladı.",
           "english_sentence": "This device, which was given the name of “computer” has started to have a huge importance in our lives."
        },
        {
           "id": 353,
           "turkish_word": "AKP",
           "english_word": "Justice and Development Party",
           "type": "n",
           "turkish_sentence": "Bu seçimi AKP kazandı.",
           "english_sentence": "AKP won this election."
        },
        {
           "id": 354,
           "turkish_word": "bunlar",
           "english_word": "these",
           "type": "pron",
           "turkish_sentence": "Bunlar ın ne olduğunu biliyor musunuz?",
           "english_sentence": "Do you know what these are?"
        },
        {
           "id": 355,
           "turkish_word": "el",
           "english_word": "hand",
           "type": "n",
           "turkish_sentence": "El el e tutuşarak bu yolda yürüdüler.",
           "english_sentence": "They walked on this road holding hands."
        },
        {
           "id": 356,
           "turkish_word": "Mustafa",
           "english_word": "Mustafa",
           "type": "n",
           "turkish_sentence": "Mustafa ’nın ne düşündüğü artık umurumda değil.",
           "english_sentence": "I no longer care about what Mustafa thinks.",
           "notes": "masculine name"
        },
        {
           "id": 357,
           "turkish_word": "güvenlik",
           "english_word": "security",
           "type": "n",
           "turkish_sentence": "Güvenlik bize birkaç soru sormadan içeri girmemize izin vermedi.",
           "english_sentence": "Security didn’t let us in without asking a few questions."
        },
        {
           "id": 358,
           "turkish_word": "kişinin",
           "english_word": "person’s",
           "type": "n",
           "turkish_sentence": "Bir kişinin sözünden daha fazlasına ihtiyacımız var.",
           "english_sentence": "We need more than one person’s words."
        },
        {
           "id": 359,
           "turkish_word": "verdiği",
           "english_word": "that s/he gave",
           "type": "ptcp",
           "turkish_sentence": "Bu, onun bana verdiği şampuan.",
           "english_sentence": "This is the shampoo that he gave me."
        },
        {
           "id": 360,
           "turkish_word": "aldı",
           "english_word": "took",
           "type": "v",
           "turkish_sentence": "Bu kitabı raftan aldı m.",
           "english_sentence": "I took this book from the shelf."
        },
        {
           "id": 361,
           "turkish_word": "haline",
           "english_word": "to/for the situation of",
           "type": "n",
           "turkish_sentence": "Onların haline ne kadar acıdığını ben gördüm.",
           "english_sentence": "I saw how he felt sorry for their situation."
        },
        {
           "id": 362,
           "turkish_word": "görev",
           "english_word": "duty",
           "type": "n",
           "turkish_sentence": "Çevreyi temiz tutmak hepimizin görev i.",
           "english_sentence": "It’s our duty to keep the environment clean."
        },
        {
           "id": 363,
           "turkish_word": "yardım",
           "english_word": "help",
           "type": "n",
           "turkish_sentence": "Ödev yaparken kimseden yardım istemez.",
           "english_sentence": "He doesn’t ask for anyone’s help on his assignments."
        },
        {
           "id": 364,
           "turkish_word": "İslam",
           "english_word": "Islam",
           "type": "n",
           "turkish_sentence": "İslam dürüst olmayı emreder.",
           "english_sentence": "Islam commands honesty.",
           "notes": "religion"
        },
        {
           "id": 365,
           "turkish_word": "mücadele",
           "english_word": "struggle",
           "type": "n",
           "turkish_sentence": "Üniversiteden mezun olmak için verdiği mücadele hepimizi etkiledi.",
           "english_sentence": "Her struggle to graduate from the university impressed us all."
        },
        {
           "id": 366,
           "turkish_word": "takım",
           "english_word": "team",
           "type": "n",
           "turkish_sentence": "İstersen bizim takım a katılabilirsin.",
           "english_sentence": "You can join our team if you like."
        },
        {
           "id": 367,
           "turkish_word": "yanlış",
           "english_word": "wrong",
           "type": "adj",
           "turkish_sentence": "Yanlış bir seçim yapmışım.",
           "english_sentence": "I made a wrong choice."
        },
        {
           "id": 368,
           "turkish_word": "yüzden",
           "english_word": "",
           "type": "conj",
           "turkish_sentence": "Bu yüzden onunla konuşmayı bıraktım.",
           "english_sentence": "That’s why I stopped talking to her.",
           "notes": "it is used with “bu”, “şu” or “o” and together it means “That’s why”, “Therefore”"
        },
        {
           "id": 369,
           "turkish_word": "kalan",
           "english_word": "remained",
           "type": "adj",
           "turkish_sentence": "Topraksız kalan köylüler sonunda şehre göç ettiler.",
           "english_sentence": "At the end, the peasants who remained landless migrated to the city."
        },
        {
           "id": 370,
           "turkish_word": "ilçe",
           "english_word": "district",
           "type": "n",
           "turkish_sentence": "Bu ilçe nin yolları çok güzel.",
           "english_sentence": "The roads in that district are very good."
        },
        {
           "id": 371,
           "turkish_word": "hala",
           "english_word": "aunt",
           "type": "n",
           "turkish_sentence": "Hala ma mı benziyorum yoksa anneanneme mi?",
           "english_sentence": "Do I resemble my aunt or my grandmother?"
        },
        {
           "id": 372,
           "turkish_word": "çalışan",
           "english_word": "those who study",
           "type": "ptcp",
           "turkish_sentence": "Çok çalışan öğrenciler genelde başarılı olur.",
           "english_sentence": "The students who study a lot usually become successful."
        },
        {
           "id": 373,
           "turkish_word": "şeklinde",
           "english_word": "shaped",
           "type": "adj",
           "turkish_sentence": "Daire şeklinde bir ayakkabısı vardı.",
           "english_sentence": "She had a circle-shaped shoe."
        },
        {
           "id": 374,
           "turkish_word": "ün",
           "english_word": "fame",
           "type": "n",
           "turkish_sentence": "Sahip olduğu ün bir noktadan sonra başına bela olmaya başladı.",
           "english_sentence": "After a while, her fame started to cause her trouble."
        },
        {
           "id": 375,
           "turkish_word": "dile",
           "english_word": "to wish",
           "type": "v",
           "turkish_sentence": "Dile rim ki mutlu olursun.",
           "english_sentence": "I wish you happiness."
        },
        {
           "id": 376,
           "turkish_word": "sonucu",
           "english_word": "result",
           "type": "n",
           "turkish_sentence": "Sınav sonucu nu bekliyoruz.",
           "english_sentence": "We are waiting for the test results."
        },
        {
           "id": 377,
           "turkish_word": "kimse",
           "english_word": "anyone",
           "type": "pron",
           "turkish_sentence": "Senden başka kimse ye söylemedim.",
           "english_sentence": "I didn’t tell anyone other than you."
        },
        {
           "id": 378,
           "turkish_word": "insanın",
           "english_word": "human’s",
           "type": "n",
           "turkish_sentence": "Mahremiyet her insanın hakkı.",
           "english_sentence": "Privacy is a right of every human being."
        },
        {
           "id": 379,
           "turkish_word": "halinde",
           "english_word": "on one’s own",
           "type": "adv",
           "turkish_sentence": "Biz kendi halinde yaşayan bir aileyiz.",
           "english_sentence": "We are a family who lives on their own."
        },
        {
           "id": 380,
           "turkish_word": "yoksa",
           "english_word": "or",
           "type": "conj",
           "turkish_sentence": "Kayak yapmayı mı seversin yoksa paten kaymayı mı?",
           "english_sentence": "Do you like skiing or skating?"
        },
        {
           "id": 381,
           "turkish_word": "film",
           "english_word": "film",
           "type": "n",
           "turkish_sentence": "Film izlemeyi sevmem.",
           "english_sentence": "I don’t like watching films."
        },
        {
           "id": 382,
           "turkish_word": "arasındaki",
           "english_word": "between",
           "type": "adj",
           "turkish_sentence": "Kare ile dikdörtgen arasındaki farklar nelerdir?",
           "english_sentence": "What are the differences between a square and a rectangle?"
        },
        {
           "id": 383,
           "turkish_word": "Kürt",
           "english_word": "Kurdish",
           "type": "n",
           "turkish_sentence": "Arkadaşımın eşi Kürt.",
           "english_sentence": "My friend’s spouse is Kurdish.",
           "notes": "people"
        },
        {
           "id": 384,
           "turkish_word": "kendisine",
           "english_word": "him/her/himself/herself",
           "type": "pron",
           "turkish_sentence": "Bu konu hakkında onun ne düşündüğünü bilmiyorum ama siz kendisine sorabilirsiniz.",
           "english_sentence": "I don’t know what he thinks about this situation however, you can ask him."
        },
        {
           "id": 385,
           "turkish_word": "ilişkin",
           "english_word": "about",
           "type": "adj",
           "turkish_sentence": "Bu sözleşmeye ilişkin kararınız nedir?",
           "english_sentence": "What is your decision about this contract?"
        },
        {
           "id": 386,
           "turkish_word": "olacaktır",
           "english_word": "will be",
           "type": "v",
           "turkish_sentence": "Eminim ki mutlu olacaktır.",
           "english_sentence": "I’m sure that she will be happy."
        },
        {
           "id": 387,
           "turkish_word": "gece",
           "english_word": "night",
           "type": "adv",
           "turkish_sentence": "Dün gece garip bir ses duydum.",
           "english_sentence": "I heard a weird noise last night."
        },
        {
           "id": 388,
           "turkish_word": "başına",
           "english_word": "on/to her/his head",
           "type": "adv",
           "turkish_sentence": "Başına kapı çarpınca yere düşmüş.",
           "english_sentence": "She fell down when the door hit her head."
        },
        {
           "id": 389,
           "turkish_word": "takip",
           "english_word": "follow",
           "type": "n",
           "turkish_sentence": "Annem Instagram’dan gönderdiğim takip isteğini reddetmiş.",
           "english_sentence": "My mother declined my follow request on Instagram."
        },
        {
           "id": 390,
           "turkish_word": "böylece",
           "english_word": "thus",
           "type": "adv",
           "turkish_sentence": "Hatalı olduğunu kabul etti, böylece barışmış olduk.",
           "english_sentence": "He admitted that he was wrong, thus we made up."
        },
        {
           "id": 391,
           "turkish_word": "geliyor",
           "english_word": "is/are coming",
           "type": "v",
           "turkish_sentence": "Kış geliyor.",
           "english_sentence": "Winter is coming."
        },
        {
           "id": 392,
           "turkish_word": "orta",
           "english_word": "middle",
           "type": "adj",
           "turkish_sentence": "Bu konuda orta yolu bulmak çok zor.",
           "english_sentence": "It is difficult to find a middle ground on this topic."
        },
        {
           "id": 393,
           "turkish_word": "ev",
           "english_word": "house",
           "type": "n",
           "turkish_sentence": "Hasan’ın ev i benim ev imden daha büyük.",
           "english_sentence": "Hasan’s house is bigger than my house."
        },
        {
           "id": 394,
           "turkish_word": "Anadolu",
           "english_word": "Anatolia",
           "type": "n",
           "turkish_sentence": "Ankara, Çankırı ve Kırıkkale İç Anadolu Bölgesi’ndeki güzide şehirlerimizdir.",
           "english_sentence": "Ankara, Cankiri and Kirikkale are our distinguished cities in the Anatolia Region."
        },
        {
           "id": 395,
           "turkish_word": "yere",
           "english_word": "on/to the ground",
           "type": "adv",
           "turkish_sentence": "Yemeğini yere koyma!",
           "english_sentence": "Don’t put your food on the ground !"
        },
        {
           "id": 396,
           "turkish_word": "oyun",
           "english_word": "game, play",
           "type": "n",
           "turkish_sentence": "Oyun, çocukların gelişimi için çok önemlidir.",
           "english_sentence": "Play is vital for children’s development."
        },
        {
           "id": 397,
           "turkish_word": "çıktı",
           "english_word": "output",
           "type": "n",
           "turkish_sentence": "Bu programın çıktı ları nelerdir?",
           "english_sentence": "What are the outputs of this program?"
        },
        {
           "id": 398,
           "turkish_word": "üzerinden",
           "english_word": "from the top",
           "type": "adv",
           "turkish_sentence": "Oyuncu, binanın üzerinden korkusuzca atladı.",
           "english_sentence": "The actress jumped fearlessly from the top of the building."
        },
        {
           "id": 399,
           "turkish_word": "sorun",
           "english_word": "problem",
           "type": "n",
           "turkish_sentence": "Çok büyük bir sorun umuz var.",
           "english_sentence": "We have a huge problem."
        },
        {
           "id": 400,
           "turkish_word": "bulunduğu",
           "english_word": "that s/he has been to",
           "type": "ptcp",
           "turkish_sentence": "Esra bu zamana kadar bulunduğu ülkelerden bahserderken hepimiz çok şaşırdık.",
           "english_sentence": "We were all amazed while Esra was talking about the countries she has been to."
        },
        {
           "id": 401,
           "turkish_word": "doğal",
           "english_word": "natural",
           "type": "adj",
           "turkish_sentence": "Bu ürün doğal mı yoksa işlenmiş mi?",
           "english_sentence": "Is this product natural or processed?"
        },
        {
           "id": 402,
           "turkish_word": "tamamen",
           "english_word": "completely",
           "type": "adv",
           "turkish_sentence": "Eğer anlattığı şey tamamen doğruysa neden panik yaptı?",
           "english_sentence": "If the things she told were completely true, then why did she panic?"
        },
        {
           "id": 403,
           "turkish_word": "sırasında",
           "english_word": "during",
           "type": "adv",
           "turkish_sentence": "Kavga sırasında biz de o bölgedeydik ama çok şükür ki bize bir şey olmadı.",
           "english_sentence": "We were in that district during the fight, but thankfully we did not get harmed."
        },
        {
           "id": 404,
           "turkish_word": "hak",
           "english_word": "right",
           "type": "n",
           "turkish_sentence": "Bu yaptığınız hak ihlaline girer!",
           "english_sentence": "What you are doing is violating my rights !"
        },
        {
           "id": 405,
           "turkish_word": "yapılacak",
           "english_word": "that is going to be done",
           "type": "adj",
           "turkish_sentence": "Yapılacaklar şu kağıtta yazıyor.",
           "english_sentence": "The things that you are going to do are written on this paper."
        },
        {
           "id": 406,
           "turkish_word": "hava",
           "english_word": "weather",
           "type": "n",
           "turkish_sentence": "Bugün hava nasıl?",
           "english_sentence": "What is the weather like today?"
        },
        {
           "id": 407,
           "turkish_word": "birliği",
           "english_word": "union of",
           "type": "n",
           "turkish_sentence": "Avrupa Birliği ülkeleri bu konu hakkında mutabakata vardı.",
           "english_sentence": "European Union countries agreed upon this subject."
        },
        {
           "id": 408,
           "turkish_word": "gelecek",
           "english_word": "future",
           "type": "n",
           "turkish_sentence": "İnsanlar, gelecek te robotların dünyayı ele geçireceğini söylüyor.",
           "english_sentence": "People say that in the future, the robots will conquer the world."
        },
        {
           "id": 409,
           "turkish_word": "mevcut",
           "english_word": "current",
           "type": "adj",
           "turkish_sentence": "Mevcut durum hiç iç açıcı değil.",
           "english_sentence": "The current situation is quite depressing."
        },
        {
           "id": 410,
           "turkish_word": "on",
           "english_word": "ten",
           "type": "num",
           "turkish_sentence": "Bu cihazın toplam on düğmesi var.",
           "english_sentence": "This device has ten buttons in total."
        },
        {
           "id": 411,
           "turkish_word": "tercih",
           "english_word": "choice",
           "type": "n",
           "turkish_sentence": "Tercih senin.",
           "english_sentence": "It’s your choice."
        },
        {
           "id": 412,
           "turkish_word": "almak",
           "english_word": "to take",
           "type": "v",
           "turkish_sentence": "Eşyalarını yanına almak istersen alabilirsin.",
           "english_sentence": "If you want to take your belongings with you, you can."
        },
        {
           "id": 413,
           "turkish_word": "hızlı",
           "english_word": "fast",
           "type": "adv",
           "turkish_sentence": "Ne kadar hızlı koşarsan koş gitmek isteyen birine yetişemezsin.",
           "english_sentence": "No matter how fast you run, you cannot catch someone who wants to leave."
        },
        {
           "id": 414,
           "turkish_word": "mu",
           "english_word": "is?",
           "type": "interr",
           "turkish_sentence": "O da seninle geliyor mu ?",
           "english_sentence": "Is she coming with you?"
        },
        {
           "id": 415,
           "turkish_word": "beraber",
           "english_word": "together",
           "type": "adv",
           "turkish_sentence": "Bu sorunu beraber halledebileceğimize inanıyorum.",
           "english_sentence": "I believe that we can handle this problem together."
        },
        {
           "id": 416,
           "turkish_word": "derece",
           "english_word": "degree",
           "type": "n",
           "turkish_sentence": "Hava bugün otuz iki derece.",
           "english_sentence": "Today, it is thirty-two degrees Celsius."
        },
        {
           "id": 417,
           "turkish_word": "içine",
           "english_word": "in/into",
           "type": "adv",
           "turkish_sentence": "Bize çantasının içine neler koyduğunu gösterdi.",
           "english_sentence": "She showed us what she put in her purse."
        },
        {
           "id": 418,
           "turkish_word": "müdür",
           "english_word": "principal",
           "type": "n",
           "turkish_sentence": "Okul müdür ü benimle konuşmak istediğini söylemiş.",
           "english_sentence": "The school principal told me that he wanted to speak with me."
        },
        {
           "id": 419,
           "turkish_word": "olmadığını",
           "english_word": "does not have/does not exist",
           "type": "ptcp",
           "turkish_sentence": "O kitabın bende olmadığını nasıl kanıtlayacağım?",
           "english_sentence": "How am I going to prove that I do not have that book?"
        },
        {
           "id": 420,
           "turkish_word": "güçlü",
           "english_word": "strong",
           "type": "adj",
           "turkish_sentence": "Güçlü bir bedene sahip olmak istiyorsan, spor yapmalısın.",
           "english_sentence": "If you want to have a strong body, you must do physical exercise."
        },
        {
           "id": 421,
           "turkish_word": "bizi",
           "english_word": "us",
           "type": "pron",
           "turkish_sentence": "Bizi kurtarabilecek tek kişi sensin.",
           "english_sentence": "You are the only person who can save us."
        },
        {
           "id": 422,
           "turkish_word": "sistem",
           "english_word": "system",
           "type": "n",
           "turkish_sentence": "Bu sistem i en iyi o bilir.",
           "english_sentence": "He knows this system the best."
        },
        {
           "id": 423,
           "turkish_word": "diyor",
           "english_word": "says",
           "type": "v",
           "turkish_sentence": "“O halde artık beni unutacak mısın?”, diyor adam kadına.",
           "english_sentence": "“So, are you going to forget me?” says the man to the woman."
        },
        {
           "id": 424,
           "turkish_word": "halde",
           "english_word": "in a situation",
           "type": "adv",
           "turkish_sentence": "Onu o halde yken nasıl bırakırsın?",
           "english_sentence": "How could you leave her in this situation ?"
        },
        {
           "id": 425,
           "turkish_word": "yana",
           "english_word": "",
           "type": "adv",
           "turkish_sentence": "Bu yana mı gidiyorsun yoksa o yana mı?",
           "english_sentence": "Are you going to this side or that side ?",
           "notes": "to"
        },
        {
           "id": 426,
           "turkish_word": "onları",
           "english_word": "them",
           "type": "pron",
           "turkish_sentence": "Onları işe ben aldım.",
           "english_sentence": "I hired them."
        },
        {
           "id": 427,
           "turkish_word": "dönemde",
           "english_word": "in a semester",
           "type": "adv",
           "turkish_sentence": "Bir dönemde en fazla on ders alabilirsin.",
           "english_sentence": "You can take maximum ten classes in one semester."
        },
        {
           "id": 428,
           "turkish_word": "gerektiği",
           "english_word": "that",
           "type": "ptcp",
           "turkish_sentence": "Özür dilemesi gerektiği ni anladı.",
           "english_sentence": "She understood that she needs to apologize.",
           "notes": "it"
        },
        {
           "id": 429,
           "turkish_word": "yanına",
           "english_word": "next to",
           "type": "adv",
           "turkish_sentence": "Sınıfta yanıma oturdu.",
           "english_sentence": "She sat next to me in the classroom."
        },
        {
           "id": 430,
           "turkish_word": "tarihinde",
           "english_word": "on the date",
           "type": "post",
           "turkish_sentence": "23 Şubat tarihinde kız kardeşim evleniyor.",
           "english_sentence": "On the date of February 23, my sister is getting married."
        },
        {
           "id": 431,
           "turkish_word": "adlı",
           "english_word": "called",
           "type": "adj",
           "turkish_sentence": "“Projeler” adlı dosyayı yöneticiye göndermelisin.",
           "english_sentence": "You should send the file called “Projects” to the manager."
        },
        {
           "id": 432,
           "turkish_word": "yıllık",
           "english_word": "annual",
           "type": "adj",
           "turkish_sentence": "Yıllık bütçemiz yaklaşık bir milyon dolar.",
           "english_sentence": "Our annual budget is around one million dollars."
        },
        {
           "id": 433,
           "turkish_word": "toplam",
           "english_word": "in total",
           "type": "adv",
           "turkish_sentence": "Hamileliğim sırasında toplam on kilo aldım.",
           "english_sentence": "I gained ten kilos in total during my pregnancy."
        },
        {
           "id": 434,
           "turkish_word": "sık",
           "english_word": "often",
           "type": "adv",
           "turkish_sentence": "Liseden mezun olduğumuzdan beri birbirimizi çok sık ziyaret etmedik.",
           "english_sentence": "Since we graduated from high school, we haven’t visited each other very often."
        },
        {
           "id": 435,
           "turkish_word": "teşekkür",
           "english_word": "thank",
           "type": "n",
           "turkish_sentence": "Asıl teşekkür etmemiz gereken kişi, bizlere bu fırsatı sunan öğretmenimiz.",
           "english_sentence": "The person we need to thank is our teacher who provided us this opportunity."
        },
        {
           "id": 436,
           "turkish_word": "dört",
           "english_word": "four",
           "type": "num",
           "turkish_sentence": "Dört kardeşten en küçüğünün adı Halil’miş.",
           "english_sentence": "Halil is the name of the youngest of the four brothers."
        },
        {
           "id": 437,
           "turkish_word": "geniş",
           "english_word": "wide",
           "type": "adj",
           "turkish_sentence": "Geniş bir dolaba sahip olmak çok rahatlatıcı.",
           "english_sentence": "Having a wide closet is a relief."
        },
        {
           "id": 438,
           "turkish_word": "grup",
           "english_word": "group",
           "type": "n",
           "turkish_sentence": "Bir öğrenci grub u, rektörlükte eylem yapıyor.",
           "english_sentence": "A group of students are protesting in front of the president’s office."
        },
        {
           "id": 439,
           "turkish_word": "şeyler",
           "english_word": "things",
           "type": "n pl",
           "turkish_sentence": "Hayat hakkındaki bazı şeyler i kabul etmekte zorlanıyorum.",
           "english_sentence": "Some things about life are hard to accept for me."
        },
        {
           "id": 440,
           "turkish_word": "tabi",
           "english_word": "subject to",
           "type": "prep/post",
           "turkish_sentence": "O bölüm bizim fakülteye tabi.",
           "english_sentence": "That department is subject to our faculty."
        },
        {
           "id": 441,
           "turkish_word": "demek",
           "english_word": "to mean",
           "type": "v",
           "turkish_sentence": "Bu ne demek ?",
           "english_sentence": "What does it mean ?"
        },
        {
           "id": 442,
           "turkish_word": "gerekiyor",
           "english_word": "to need",
           "type": "v",
           "turkish_sentence": "Sınavdan önce yüz sayfa makale okumam gerekiyor.",
           "english_sentence": "I need to read one hundred pages of articles before the exam."
        },
        {
           "id": 443,
           "turkish_word": "meşgul",
           "english_word": "busy",
           "type": "adj",
           "turkish_sentence": "O bugünlerde çok meşgul.",
           "english_sentence": "He is quite busy these days."
        },
        {
           "id": 444,
           "turkish_word": "Erdoğan",
           "english_word": "a surname",
           "type": "n",
           "turkish_sentence": "Cumhurbaşkanı Erdoğan Lübnan’a ziyarette bulundu.",
           "english_sentence": "President Erdoğan paid a visit to Lebanon."
        },
        {
           "id": 445,
           "turkish_word": "bence",
           "english_word": "I think/in my opinion",
           "type": "adv",
           "turkish_sentence": "Bence her insan özgürce yaşamak ister.",
           "english_sentence": "I think everyone in the world wants to live free."
        },
        {
           "id": 446,
           "turkish_word": "kontrol",
           "english_word": "control",
           "type": "n",
           "turkish_sentence": "Son kontrol den sonra ödevi öğretmene göndereceğim.",
           "english_sentence": "I will send the assignment after the last control."
        },
        {
           "id": 447,
           "turkish_word": "Eylül",
           "english_word": "September",
           "type": "n",
           "turkish_sentence": "Eylül en sevdiğim aydır.",
           "english_sentence": "September is my favorite month."
        },
        {
           "id": 448,
           "turkish_word": "adet",
           "english_word": "number/piece",
           "type": "n",
           "turkish_sentence": "Bu dolabında kaç adet mandalina var?",
           "english_sentence": "How many tangerines are there in the fridge?"
        },
        {
           "id": 449,
           "turkish_word": "aldığı",
           "english_word": "that s/he took",
           "type": "ptcp",
           "turkish_sentence": "Aldığı kitapları geri getirmedi.",
           "english_sentence": "He did not bring the books that he took."
        },
        {
           "id": 450,
           "turkish_word": "Ahmet",
           "english_word": "Ahmet",
           "type": "n",
           "turkish_sentence": "Ahmet bizim sınıfın en başarılı öğrencisidir.",
           "english_sentence": "Ahmet is the most successful student in our classroom.",
           "notes": "masculine name"
        },
        {
           "id": 451,
           "turkish_word": "yandan",
           "english_word": "from … side",
           "type": "adv",
           "turkish_sentence": "O yandan ses seda çıkmadı.",
           "english_sentence": "We didn’t hear anything from that side."
        },
        {
           "id": 452,
           "turkish_word": "dış",
           "english_word": "foreign/outside",
           "type": "n",
           "turkish_sentence": "Ablam Dış İşleri Bakanlığı’nda çalışıyor.",
           "english_sentence": "My sister works for the Ministry of Foreign Affairs."
        },
        {
           "id": 453,
           "turkish_word": "meydana gelen",
           "english_word": "that happened",
           "type": "adj",
           "turkish_sentence": "Dün meydana gelen kazada iki kişi hayatını kaybetti.",
           "english_sentence": "Two people lost their lives in the accident that happened yesterday."
        },
        {
           "id": 454,
           "turkish_word": "başbakan",
           "english_word": "president",
           "type": "n",
           "turkish_sentence": "Halk verdiği son kararlardan dolayı Başbakan ’a kızgın.",
           "english_sentence": "People are angry at the President because of the last decisions he made."
        },
        {
           "id": 455,
           "turkish_word": "aile",
           "english_word": "family",
           "type": "n",
           "turkish_sentence": "İki aile arasındaki tartışmalar bir aile özür dileyince sonlandı.",
           "english_sentence": "The conflict between the two families have come to an end after a family apologized."
        },
        {
           "id": 456,
           "turkish_word": "toplum",
           "english_word": "society",
           "type": "n",
           "turkish_sentence": "Sosyologlar toplum u inceler ve toplum hakkında araştırmalar yaparlar.",
           "english_sentence": "Sociologists analyze the society and make research about it."
        },
        {
           "id": 457,
           "turkish_word": "yabancı",
           "english_word": "stranger",
           "type": "n",
           "turkish_sentence": "Ben küçükken annem yabancı larla konuşmamamı söylerdi.",
           "english_sentence": "When I was younger, my mother used to tell me not to talk to strangers."
        },
        {
           "id": 458,
           "turkish_word": "kitap",
           "english_word": "book",
           "type": "n",
           "turkish_sentence": "Bir sürü insan kitap ları insanlara tercih ediyor.",
           "english_sentence": "There are lots of people who prefer books over humans."
        },
        {
           "id": 459,
           "turkish_word": "dolayısıyla",
           "english_word": "therefore",
           "type": "conj",
           "turkish_sentence": "Bu akşam için başka bir arkadaşıma söz verdim, dolayısıyla programa katılamayacağım.",
           "english_sentence": "I have a date with a friend of mine tonight; therefore, I will not be attending the program."
        },
        {
           "id": 460,
           "turkish_word": "istiyorum",
           "english_word": "I want",
           "type": "v",
           "turkish_sentence": "Ders çalışmaktan çok sıkıldım, hemen mezun olmak istiyorum.",
           "english_sentence": "I am sick and tired of studying; I want to graduate immediately."
        },
        {
           "id": 461,
           "turkish_word": "beri",
           "english_word": "since",
           "type": "postp",
           "turkish_sentence": "Küçüklüğünden beri bilime her zaman ilgi duymuştur.",
           "english_sentence": "She has always been interested in science, since she was a little girl."
        },
        {
           "id": 462,
           "turkish_word": "bazen",
           "english_word": "sometimes",
           "type": "adv",
           "turkish_sentence": "Bazen nasıl bu kadar yorulduğumu anlamıyorum.",
           "english_sentence": "Sometimes, I cannot understand how I get so tired."
        },
        {
           "id": 463,
           "turkish_word": "bunlar",
           "english_word": "these",
           "type": "pron",
           "turkish_sentence": "Bunlar ı alıp mutfaktaki dolaba koyabilir misin?",
           "english_sentence": "Can you take these and put them in the closet in the kitchen?"
        },
        {
           "id": 464,
           "turkish_word": "enerji",
           "english_word": "energy",
           "type": "n",
           "turkish_sentence": "Yeteri kadar enerji m olmadığında kahve içerek daha iyi hissetmeye çalışıyorum.",
           "english_sentence": "Whenever I do not have energy, I try to feel better by drinking a cup of coffee."
        },
        {
           "id": 465,
           "turkish_word": "dünyadaki",
           "english_word": "in the world",
           "type": "adv",
           "turkish_sentence": "Eğer sesimizi çıkarmazsak, dünyadaki karmaşa ve kaostan yine bizler de sorumluyuz.",
           "english_sentence": "If we remain silent, we are also responsible for the conflicts and the chaos in the world."
        },
        {
           "id": 466,
           "turkish_word": "İsrail",
           "english_word": "Israel",
           "type": "n",
           "turkish_sentence": "İsrail ve Filistin arasındaki sorunlar hala çözüme kavuşamadı.",
           "english_sentence": "The problems between Israel and Palestine have not been solved yet."
        },
        {
           "id": 467,
           "turkish_word": "belirten",
           "english_word": "indicating",
           "type": "ptcp",
           "turkish_sentence": "Makinede bir sorun olduğunu belirten sinyalleri görmezden geldik ve makine en sonunda bozuldu.",
           "english_sentence": "We ignored the signals that indicated the problems of the machine and it eventually broke down."
        },
        {
           "id": 468,
           "turkish_word": "önceki",
           "english_word": "previous",
           "type": "adj",
           "turkish_sentence": "Önceki bölümü izlemeden bunu anlaman imkansız.",
           "english_sentence": "It is impossible for you to understand this case before watching the previous episode."
        },
        {
           "id": 469,
           "turkish_word": "kim",
           "english_word": "who",
           "type": "pron",
           "turkish_sentence": "Kim in aradığını bilmiyorum.",
           "english_sentence": "I do not know who called me."
        },
        {
           "id": 470,
           "turkish_word": "örneğin",
           "english_word": "for example",
           "type": "prep",
           "turkish_sentence": "Vejetaryen yemekler etsiz olur. Örneğin, sebzeli pizza vejetaryen bir yemektir.",
           "english_sentence": "Vegetarian meals are cooked without meat. For example, veggie pizza is a vegetarian meal."
        },
        {
           "id": 471,
           "turkish_word": "orada",
           "english_word": "there",
           "type": "pron",
           "turkish_sentence": "Yarın geri döneceğim için eşyalarımı orada bıraktım.",
           "english_sentence": "I left my belongings there because I am going to come back tomorrow."
        },
        {
           "id": 472,
           "turkish_word": "AB",
           "english_word": "EU",
           "type": "n",
           "turkish_sentence": "Türkiye ve AB ilişkileri güçleniyor.",
           "english_sentence": "The relationship between Turkey and the EU is getting stronger."
        },
        {
           "id": 473,
           "turkish_word": "basın",
           "english_word": "press",
           "type": "n",
           "turkish_sentence": "Basın açıklaması yapıldıktan sonra olay aydınlandı.",
           "english_sentence": "After the press release, we were enlightened about the details of the case."
        },
        {
           "id": 474,
           "turkish_word": "karşısında",
           "english_word": "against",
           "type": "prep/post",
           "turkish_sentence": "Şimdi herkes onun karşısında bir pozisyon aldı.",
           "english_sentence": "Now everybody has taken a stance against her."
        },
        {
           "id": 475,
           "turkish_word": "sene",
           "english_word": "year",
           "type": "n",
           "turkish_sentence": "Bu sene balık burcu olanların aşk hayatında inanılmaz gelişmeler olacakmış.",
           "english_sentence": "This year, Pisces will have tremendous developments in their love life."
        },
        {
           "id": 476,
           "turkish_word": "AK",
           "english_word": "AK",
           "type": "n",
           "turkish_sentence": "AK Parti hükûmeti bu yasayı yürürlüğe koydu.",
           "english_sentence": "The government of AK Party promulgated this law.",
           "notes": "stands for Adalet ve Kalkınma which means Justice and Development"
        },
        {
           "id": 477,
           "turkish_word": "yaşam",
           "english_word": "life",
           "type": "n",
           "turkish_sentence": "Yaşam sürprizlerle dolu.",
           "english_sentence": "Life is full of surprises."
        },
        {
           "id": 478,
           "turkish_word": "olmuş",
           "english_word": "I heard that s/he became",
           "type": "v",
           "turkish_sentence": "Duyduğuma göre o, şirkette genel müdür olmuş.",
           "english_sentence": "I heard that she became the general manager at the firm."
        },
        {
           "id": 479,
           "turkish_word": "örnek",
           "english_word": "example",
           "type": "n",
           "turkish_sentence": "Çocuklara bir örnek teşkil etmesi için onu sınıfımıza davet ettim.",
           "english_sentence": "I invited her to our classroom to set an example to the children."
        },
        {
           "id": 480,
           "turkish_word": "önünde",
           "english_word": "in front of",
           "type": "adv",
           "turkish_sentence": "Bilekliğimi evin önünde düşürmüşüm.",
           "english_sentence": "I dropped my bracelet in front of the house."
        },
        {
           "id": 481,
           "turkish_word": "olmadığı",
           "english_word": "that has no/without",
           "type": "ptcp",
           "turkish_sentence": "Haksızlıkların olmadığı bir dünya diliyorum.",
           "english_sentence": "I wish to see a world that has no injustice in it."
        },
        {
           "id": 482,
           "turkish_word": "yardımcı",
           "english_word": "assistant",
           "type": "n",
           "turkish_sentence": "Okumalarıma daha iyi odaklanabilmek için bir yardımcı işe aldım.",
           "english_sentence": "I hired an assistant to be able to focus on my readings more."
        },
        {
           "id": 483,
           "turkish_word": "Amerika",
           "english_word": "U.S.A",
           "type": "n",
           "turkish_sentence": "Amerika ile Türkiye arasındaki ilişkileri anlatan bir kitap okudum.",
           "english_sentence": "I read a book about the relationship between the States and Turkey."
        },
        {
           "id": 484,
           "turkish_word": "varsa",
           "english_word": "if there is/if available",
           "type": "adv",
           "turkish_sentence": "Yardımcı olabileceğim herhangi bir şey varsa, lütfen söylemekten çekinmeyin.",
           "english_sentence": "Please do not hesitate to ask; if there is anything I can help you with."
        },
        {
           "id": 485,
           "turkish_word": "İzmir",
           "english_word": "a city in Turkey",
           "type": "n",
           "turkish_sentence": "İzmir ’e gittiğimde sahilde vakit geçirmeyi çok seviyorum.",
           "english_sentence": "I love spending time on the coast when I go to Izmir."
        },
        {
           "id": 486,
           "turkish_word": "Atatürk",
           "english_word": "surname of the founder of the Republic of Turkey",
           "type": "n",
           "turkish_sentence": "Atatürk, 1881 yılında Selanik’te doğmuştur.",
           "english_sentence": "Ataturk was born in the year of 1881, in Thessalonika."
        },
        {
           "id": 487,
           "turkish_word": "durum",
           "english_word": "status",
           "type": "n",
           "turkish_sentence": "Medeni durum unun bekar olduğunu söyledi.",
           "english_sentence": "She said that her marital status is single."
        },
        {
           "id": 488,
           "turkish_word": "deniz",
           "english_word": "sea",
           "type": "n",
           "turkish_sentence": "Deniz tuzu kullanıma uygun değil.",
           "english_sentence": "Sea salt is not edible."
        },
        {
           "id": 489,
           "turkish_word": "ziyaret",
           "english_word": "visit",
           "type": "n",
           "turkish_sentence": "Bugün huzur evini ziyaret etmeyi düşünüyorum.",
           "english_sentence": "Today, I am planning to visit a nursing home."
        },
        {
           "id": 490,
           "turkish_word": "ileri",
           "english_word": "ahead",
           "type": "adv",
           "turkish_sentence": "Korkudan bir adım bile ileri gitmediler.",
           "english_sentence": "They did not even take one step ahead because of their fear."
        },
        {
           "id": 491,
           "turkish_word": "-ı/-i/-u/-ü",
           "english_word": "accusative suffixes",
           "type": "~",
           "turkish_sentence": "Eda’yı aradım ama telefona cevap vermedi.",
           "english_sentence": "I called Eda but she did not respond to my call.",
           "notes": "used with -y or -n when the final sound of the root is a vowel"
        },
        {
           "id": 492,
           "turkish_word": "ediyorum",
           "english_word": "I do",
           "type": "aux",
           "turkish_sentence": "Ona dışarı çıkmayı teklif ediyorum ama asla kabul etmiyor.",
           "english_sentence": "I ask him out, but he never accepts my offer.",
           "notes": "verb"
        },
        {
           "id": 493,
           "turkish_word": "resmi",
           "english_word": "official",
           "type": "adj",
           "turkish_sentence": "Resmi bir toplantı olduğu için bizi içeri almadılar.",
           "english_sentence": "They did not let us in because it was an official meeting."
        },
        {
           "id": 494,
           "turkish_word": "yılı",
           "english_word": "the year of",
           "type": "n",
           "turkish_sentence": "1998 yılı benim için çok önemliydi.",
           "english_sentence": "The year of 1998 had a huge importance to me."
        },
        {
           "id": 495,
           "turkish_word": "yol",
           "english_word": "road",
           "type": "n",
           "turkish_sentence": "Temiz olan yol u tercih ettiğim için beni suçlayamazsın.",
           "english_sentence": "You cannot blame me for preferring the clean road."
        },
        {
           "id": 496,
           "turkish_word": "savaş",
           "english_word": "war",
           "type": "n",
           "turkish_sentence": "Herkesin isteği dünya barışıyken, savaş lar hala devam ediyor.",
           "english_sentence": "War s continue to happen while everyone’s wish is for world peace."
        },
        {
           "id": 497,
           "turkish_word": "olmaz",
           "english_word": "there is no",
           "type": "v",
           "turkish_sentence": "Eczanede süt olmaz.",
           "english_sentence": "There is no milk in the pharmacy."
        },
        {
           "id": 498,
           "turkish_word": "belediyesi",
           "english_word": "municipality of",
           "type": "n",
           "turkish_sentence": "İstanbul Büyükşehir Belediyesi gerekli yardımların yapılacağını söyledi.",
           "english_sentence": "Istanbul Metropolitan Municipality said that they will provide the necessary help."
        },
        {
           "id": 499,
           "turkish_word": "okul",
           "english_word": "school",
           "type": "n",
           "turkish_sentence": "Okul a gitmeseydim günlerimi nasıl geçirirdim hiç bilmiyorum.",
           "english_sentence": "I do not know how I would spend my days if I did not attend school."
        },
        {
           "id": 500,
           "turkish_word": "henüz",
           "english_word": "yet",
           "type": "adv",
           "turkish_sentence": "Teklifine ne cevap vereceğime henüz karar veremedim.",
           "english_sentence": "I could not decide how to reply to her offer, yet."
        },
        {
           "id": 501,
           "turkish_word": "tarih",
           "english_word": "history",
           "type": "n",
           "turkish_sentence": "Tarih derslerine katılmayı hiçbir zaman sevemedim.",
           "english_sentence": "I have never enjoyed attending history classes."
        },
        {
           "id": 502,
           "turkish_word": "sayesinde",
           "english_word": "thanks to …",
           "type": "adv",
           "turkish_sentence": "Bu siteyi onun sayesinde buldum.",
           "english_sentence": "I found this website thanks to her."
        },
        {
           "id": 503,
           "turkish_word": "erkek",
           "english_word": "male, man",
           "type": "n",
           "turkish_sentence": "Yanlışlıkla erkek ler tuvaletine girmişim.",
           "english_sentence": "I accidently entered the men’s room."
        },
        {
           "id": 504,
           "turkish_word": "proje",
           "english_word": "project",
           "type": "n",
           "turkish_sentence": "Proje mizin kabul alacağını umuyoruz.",
           "english_sentence": "We are hoping that our project will be accepted."
        },
        {
           "id": 505,
           "turkish_word": "yaşayan",
           "english_word": "who live",
           "type": "ptcp",
           "turkish_sentence": "Bu köyde yaşayan insanların ekonomik durumu iyi değil.",
           "english_sentence": "The financial status of those who live in this village is not good."
        },
        {
           "id": 506,
           "turkish_word": "kaç",
           "english_word": "how many",
           "type": "adj",
           "turkish_sentence": "Kaç kişi piyano çalabiliyor?",
           "english_sentence": "How many of you can play the piano?"
        },
        {
           "id": 507,
           "turkish_word": "itibaren",
           "english_word": "starting from; since",
           "type": "postp",
           "turkish_sentence": "Yarından itibaren okul 08.30’da başlayacak.",
           "english_sentence": "Starting from tomorrow, school starts at 08:30."
        },
        {
           "id": 508,
           "turkish_word": "yoğun",
           "english_word": "busy",
           "type": "adj",
           "turkish_sentence": "Bir keresinde yoğun bir günün ardından on saat uyumuştum.",
           "english_sentence": "Once, I slept ten hours after a busy day."
        },
        {
           "id": 509,
           "turkish_word": "tabii",
           "english_word": "of course",
           "type": "adv",
           "turkish_sentence": "Tabii ki de ne kadar ihtiyacın varsa kullan.",
           "english_sentence": "Of course, you can use it as much as you need."
        },
        {
           "id": 510,
           "turkish_word": "altın",
           "english_word": "gold",
           "type": "n",
           "turkish_sentence": "Yatırımı altın a mı yapmalıyız dolara mı?",
           "english_sentence": "Should we invest in gold or dollars?"
        },
        {
           "id": 511,
           "turkish_word": "-la",
           "english_word": "with",
           "type": "postp",
           "turkish_sentence": "Onunla yken zaman nasıl geçiyor anlamıyorum.",
           "english_sentence": "I lose track of the time when I am with him."
        },
        {
           "id": 512,
           "turkish_word": "ağır",
           "english_word": "heavy",
           "type": "adv",
           "turkish_sentence": "Ayakkabılarım çok ağır olduğu için yürümekte zorlanıyorum.",
           "english_sentence": "I find it difficult to walk because of my heavy shoes."
        },
        {
           "id": 513,
           "turkish_word": "olursa",
           "english_word": "if there is",
           "type": "adv",
           "turkish_sentence": "Odada birileri olursa ders çalışamam.",
           "english_sentence": "I will not be able to study if there is someone in the room."
        },
        {
           "id": 514,
           "turkish_word": "kendisi",
           "english_word": "him/herself",
           "type": "pron",
           "turkish_sentence": "Ben bu konu hakkında yorum yapamam ama kendisi bir açıklamada bulunabilir.",
           "english_sentence": "I cannot comment about this but she, herself, can make an explanation."
        },
        {
           "id": 515,
           "turkish_word": "onlara",
           "english_word": "them",
           "type": "pron",
           "turkish_sentence": "Onlara sorulan sorulara sen cevap veremezsin.",
           "english_sentence": "You cannot answer the questions that are posed to them."
        },
        {
           "id": 516,
           "turkish_word": "Bey",
           "english_word": "Mr.",
           "type": "n",
           "turkish_sentence": "Bu dosyaları Ahmet Bey ’e iletir misiniz?",
           "english_sentence": "Can you deliver these files to Mr. Ahmet?"
        },
        {
           "id": 517,
           "turkish_word": "oluşan",
           "english_word": "that is formed",
           "type": "ptcp",
           "turkish_sentence": "Depremden sonra duvarda oluşan çatlakları görünce şok olduk.",
           "english_sentence": "We were shocked when we saw the cracks that were formed after the earthquake."
        },
        {
           "id": 518,
           "turkish_word": "fark",
           "english_word": "difference",
           "type": "n",
           "turkish_sentence": "İki resim arasındaki fark ı buldun mu?",
           "english_sentence": "Did you find the differences between the two pictures?"
        },
        {
           "id": 519,
           "turkish_word": "hayat",
           "english_word": "life",
           "type": "n",
           "turkish_sentence": "Hayat ımda böyle bir güzellik görmedim!",
           "english_sentence": "I have never seen anything that beautiful in my life!"
        },
        {
           "id": 520,
           "turkish_word": "çoğu",
           "english_word": "most of …",
           "type": "adj",
           "turkish_sentence": "Çoğu zaman kırılsa da kimseye bir şey söylemezdi.",
           "english_sentence": "Even though she gets hurt most of the time, she would never say anything to anyone."
        },
        {
           "id": 521,
           "turkish_word": "başında",
           "english_word": "at the beginning",
           "type": "adv",
           "turkish_sentence": "Günün başında çok enerjikken, sonlara doğru çok yorgun hissediyorum.",
           "english_sentence": "I feel very energetic at the beginning of the day but towards the end I feel very tired."
        },
        {
           "id": 522,
           "turkish_word": "milyar",
           "english_word": "billion",
           "type": "num",
           "turkish_sentence": "Dünya’da yaklaşık sekiz milyar insan var.",
           "english_sentence": "There are almost eight billion people in the world."
        },
        {
           "id": 523,
           "turkish_word": "seçim",
           "english_word": "election",
           "type": "n",
           "turkish_sentence": "En son yapılan seçim de oy kullandın mı?",
           "english_sentence": "Did you vote in the last election ?"
        },
        {
           "id": 524,
           "turkish_word": "mutlu",
           "english_word": "happy",
           "type": "adj",
           "turkish_sentence": "Bu mutlu günümde yanımda olduğunuz için teşekkür ederim.",
           "english_sentence": "Thank you so much for being there on this happy day."
        },
        {
           "id": 525,
           "turkish_word": "zorunda",
           "english_word": "being obliged to …",
           "type": "adj",
           "turkish_sentence": "Bunu yapmak zorunda değilsin.",
           "english_sentence": "You do not have to do this."
        },
        {
           "id": 526,
           "turkish_word": "ön",
           "english_word": "front",
           "type": "adj",
           "turkish_sentence": "Ön koltuklar boş. İstersen oraya oturabiliriz.",
           "english_sentence": "The front seats are empty. We can sit there if you like."
        },
        {
           "id": 527,
           "turkish_word": "olay",
           "english_word": "incident",
           "type": "n",
           "turkish_sentence": "O olay dan sonra kendisinden bird aha haber alınamamış.",
           "english_sentence": "They never heard from him after that incident."
        },
        {
           "id": 528,
           "turkish_word": "kendisine",
           "english_word": "",
           "type": "pron",
           "turkish_sentence": "Kendisine yeni bir gömlek almış.",
           "english_sentence": "She bought herself a new shirt.",
           "notes": "for"
        },
        {
           "id": 529,
           "turkish_word": "güç",
           "english_word": "power",
           "type": "n",
           "turkish_sentence": "Parası olanların güç sahibi olduğu bir dünyada yaşıyoruz.",
           "english_sentence": "We are living in a world where those who have money have the power."
        },
        {
           "id": 530,
           "turkish_word": "birinci",
           "english_word": "the first",
           "type": "adj",
           "turkish_sentence": "Birinci maddeyi işaretlemeden ikinciye geçilmiyormuş.",
           "english_sentence": "You cannot skip to the second article before the first one."
        },
        {
           "id": 531,
           "turkish_word": "şey",
           "english_word": "thing",
           "type": "n",
           "turkish_sentence": "Aynı şey i beş kere sordum ama yine de anlamadım.",
           "english_sentence": "I asked the same thing five times and still could not understand."
        },
        {
           "id": 532,
           "turkish_word": "mutlaka",
           "english_word": "definitely",
           "type": "adv",
           "turkish_sentence": "Yarın mutlaka görüşelim.",
           "english_sentence": "We should definitely meet tomorrow."
        },
        {
           "id": 533,
           "turkish_word": "dün",
           "english_word": "yesterday",
           "type": "adv",
           "turkish_sentence": "Dün çok hastaydım.",
           "english_sentence": "I was very sick yesterday."
        },
        {
           "id": 534,
           "turkish_word": "müdürlük",
           "english_word": "directorate",
           "type": "n",
           "turkish_sentence": "İl Milli Eğitim Müdürlüğü staj saatlerimizin değişemeyeceğini söyledi.",
           "english_sentence": "The Provincial Directorate for National Education said that our practicum hours will not change."
        },
        {
           "id": 535,
           "turkish_word": "edildi",
           "english_word": "have been",
           "type": "v",
           "turkish_sentence": "Sunduğum tüm öneriler kabul edildi.",
           "english_sentence": "All the suggestions I made have been accepted."
        },
        {
           "id": 536,
           "turkish_word": "kendisini",
           "english_word": "him/himself/her/herself",
           "type": "pron",
           "turkish_sentence": "Kendisini o olaydan sonra bir daha hiç görmedim.",
           "english_sentence": "I have not seen him since that incident."
        },
        {
           "id": 537,
           "turkish_word": "başlayan",
           "english_word": "the one whose … start",
           "type": "ptcp",
           "turkish_sentence": "İsmi K harfiyle başlayan lar şu koltuğa oturabilir.",
           "english_sentence": "Those whose names start with the letter K may be seated on that sofa."
        },
        {
           "id": 538,
           "turkish_word": "alt",
           "english_word": "down",
           "type": "adj",
           "turkish_sentence": "Alt kata inerken merdivenden düştüm.",
           "english_sentence": "I fell while going down the stairs."
        },
        {
           "id": 539,
           "turkish_word": "iş",
           "english_word": "job",
           "type": "n",
           "turkish_sentence": "Bu iş i haftaya cumaya kadar yetiştirmem lazım.",
           "english_sentence": "I need to finish this job before next Friday."
        },
        {
           "id": 540,
           "turkish_word": "kur",
           "english_word": "rate",
           "type": "n",
           "turkish_sentence": "Döviz kur ları oldukça değişken.",
           "english_sentence": "Foreign exchange rates are fluctuating."
        },
        {
           "id": 541,
           "turkish_word": "Mayıs",
           "english_word": "May",
           "type": "n",
           "turkish_sentence": "Mayıs ayında düğünüm var.",
           "english_sentence": "My wedding is in May."
        },
        {
           "id": 542,
           "turkish_word": "sayısı",
           "english_word": "the number of",
           "type": "n",
           "turkish_sentence": "Bu dersi alan öğrencilerin sayısı nı bilmiyorum.",
           "english_sentence": "I do not know the number of students who enrolled in this course."
        },
        {
           "id": 543,
           "turkish_word": "alınan",
           "english_word": "that is taken",
           "type": "ptcp",
           "turkish_sentence": "Profesörler tarafından alınan son karara göre iki ara sınav bir final olacakmış.",
           "english_sentence": "According to the final decision that is taken by the professors, there are going to be two midterms and one final."
        },
        {
           "id": 544,
           "turkish_word": "isteyen",
           "english_word": "the one who wishes",
           "type": "ptcp",
           "turkish_sentence": "İsteyen herkes katılım sağlayabilir mi?",
           "english_sentence": "Can anyone who wishes to attend join this program?"
        },
        {
           "id": 545,
           "turkish_word": "izin",
           "english_word": "permission",
           "type": "n",
           "turkish_sentence": "Ondan da mı izin almam gerekiyor?",
           "english_sentence": "Do I need to ask for her permission as well?"
        },
        {
           "id": 546,
           "turkish_word": "başta",
           "english_word": "at first",
           "type": "adv",
           "turkish_sentence": "Başta onu çok sevmemiştim ama şimdi onsuz vakit geçiremiyorum.",
           "english_sentence": "At first, I did not like him that much but now I cannot spend time without him."
        },
        {
           "id": 547,
           "turkish_word": "lazım",
           "english_word": "needed",
           "type": "adj",
           "turkish_sentence": "Önce anneme sormam lazım sonra sana haber veririm.",
           "english_sentence": "First, I need to ask my mother, and then I will let you know."
        },
        {
           "id": 548,
           "turkish_word": "kız",
           "english_word": "girl",
           "type": "n",
           "turkish_sentence": "Kız lar voleybol oynamak istiyorlarmış.",
           "english_sentence": "The girls want to play volleyball."
        },
        {
           "id": 549,
           "turkish_word": "kamu",
           "english_word": "public",
           "type": "n",
           "turkish_sentence": "Kamu ya açık bir alanda sigara içilmesini doğru bulmuyorum.",
           "english_sentence": "I do not find it appropriate to smoke in public."
        },
        {
           "id": 550,
           "turkish_word": "yemek",
           "english_word": "meal",
           "type": "n",
           "turkish_sentence": "Yemek yedikten sonra daha iyi hissetmeye başladım.",
           "english_sentence": "I started to feel better after I had a meal."
        },
        {
           "id": 551,
           "turkish_word": "Osmanlı",
           "english_word": "Ottoman",
           "type": "n",
           "turkish_sentence": "Osmanlı Devleti yıkıldıktan sonra Türkiye Cumhuriyeti kuruldu.",
           "english_sentence": "After the Ottoman Empire collapsed, the Republic of Turkey was established."
        },
        {
           "id": 552,
           "turkish_word": "bakanlığı",
           "english_word": "Ministry of",
           "type": "n",
           "turkish_sentence": "Milli Eğitim Bakanlığı ’nın öğretmenler için çıkardığı rehber kitap çok beğenildi.",
           "english_sentence": "The guidebook that the Ministry of Education published is liked very much."
        },
        {
           "id": 553,
           "turkish_word": "Almanya",
           "english_word": "Germany",
           "type": "n",
           "turkish_sentence": "Evlendikten sonra Almanya ’ya taşınmayı düşünüyorum.",
           "english_sentence": "I am planning to move to Germany after marriage."
        },
        {
           "id": 554,
           "turkish_word": "Hz",
           "english_word": "Respectable",
           "type": "adj",
           "turkish_sentence": "Hz. Muhammed son peygamberdir.",
           "english_sentence": "The Respectable Muhammad is the final prophet."
        },
        {
           "id": 555,
           "turkish_word": "kan",
           "english_word": "blood",
           "type": "n",
           "turkish_sentence": "Sabah yerde kan gördüm.",
           "english_sentence": "In the morning, I saw blood on the floor."
        },
        {
           "id": 556,
           "turkish_word": "amacıyla",
           "english_word": "with the purpose of",
           "type": "post",
           "turkish_sentence": "Buluşma amacıyla bir grup kurduk.",
           "english_sentence": "We made this group with the purpose of meeting."
        },
        {
           "id": 557,
           "turkish_word": "bakanı",
           "english_word": "minister of",
           "type": "n",
           "turkish_sentence": "Ekonomi bakanı açıklama yapıyor.",
           "english_sentence": "The Minister of the Economy is making statement."
        },
        {
           "id": 558,
           "turkish_word": "düzenlenen",
           "english_word": "that was organized",
           "type": "adj",
           "turkish_sentence": "Yılbaşı için düzenlenen partiye katıldım.",
           "english_sentence": "I joined a party that was organized for New Year’s Eve."
        },
        {
           "id": 559,
           "turkish_word": "sonuç",
           "english_word": "consequence",
           "type": "n",
           "turkish_sentence": "Yaptıklarının sonuç larına katlanmak zorundasın.",
           "english_sentence": "You need to put up with the consequences of your actions."
        },
        {
           "id": 560,
           "turkish_word": "İran",
           "english_word": "Iran",
           "type": "n",
           "turkish_sentence": "İran petrol kaynakları ile ünlüdür.",
           "english_sentence": "Iran is known for its petrol reserves."
        },
        {
           "id": 561,
           "turkish_word": "defa",
           "english_word": "times",
           "type": "adv",
           "turkish_sentence": "Sana bunu dört defa anlattım!",
           "english_sentence": "I told you this four times !"
        },
        {
           "id": 562,
           "turkish_word": "Irak",
           "english_word": "Iraq",
           "type": "n",
           "turkish_sentence": "Abim Irak ’ta askerlik yapıyor.",
           "english_sentence": "My brother is doing his military service in Iraq."
        },
        {
           "id": 563,
           "turkish_word": "ticaret",
           "english_word": "trade",
           "type": "n",
           "turkish_sentence": "Amcam ticaret yapmak istiyordu.",
           "english_sentence": "My uncle wanted to make a trade."
        },
        {
           "id": 564,
           "turkish_word": "dahil",
           "english_word": "including",
           "type": "prep/post",
           "turkish_sentence": "Bunları sen dahil herkes uygulayacak.",
           "english_sentence": "Everyone will apply these, including you."
        },
        {
           "id": 565,
           "turkish_word": "Cumhuriyet",
           "english_word": "Republic",
           "type": "n",
           "turkish_sentence": "Türkiye Cumhuriyet i Devleti 1923 yılında kurulmuştur.",
           "english_sentence": "The Republic of Turkey was founded in the year of 1923."
        },
        {
           "id": 566,
           "turkish_word": "olmuştur",
           "english_word": "it’s been",
           "type": "v",
           "turkish_sentence": "Eda’yla görüşmeyeli altı yıl olmuştur.",
           "english_sentence": "It’s been six years since the last time I saw Eda.",
           "notes": "presumably"
        },
        {
           "id": 567,
           "turkish_word": "milletvekili",
           "english_word": "congressman/congresswoman",
           "type": "n",
           "turkish_sentence": "Ablam milletvekili danışmanı olarak çalışıyor.",
           "english_sentence": "My sister is working as a congressman ’s advisor."
        },
        {
           "id": 568,
           "turkish_word": "askeri",
           "english_word": "military",
           "type": "adj",
           "turkish_sentence": "Askeri okula gitmek benim hayalim.",
           "english_sentence": "Studying at the military school is my dream."
        },
        {
           "id": 569,
           "turkish_word": "tedavi",
           "english_word": "treatment",
           "type": "n",
           "turkish_sentence": "Bu tedavi benim için çok önemli.",
           "english_sentence": "This treatment is very important for me."
        },
        {
           "id": 570,
           "turkish_word": "babam",
           "english_word": "my father",
           "type": "n",
           "turkish_sentence": "Babam ı savaşta kaybettim.",
           "english_sentence": "I lost my dad in the war."
        },
        {
           "id": 571,
           "turkish_word": "profesör",
           "english_word": "professor",
           "type": "n",
           "turkish_sentence": "Profesör bize bir seminer verdi.",
           "english_sentence": "The professor gave us a seminar."
        },
        {
           "id": 572,
           "turkish_word": "Rusya",
           "english_word": "Russia",
           "type": "n",
           "turkish_sentence": "Kardeşim 1995’te Rusya ’da doğdu.",
           "english_sentence": "My sister was born in 1995, in Russia."
        },
        {
           "id": 573,
           "turkish_word": "üretim",
           "english_word": "production",
           "type": "n",
           "turkish_sentence": "Üretim müdürü çalışanlarla konuşuyor.",
           "english_sentence": "The production manager is talking to the employees."
        },
        {
           "id": 574,
           "turkish_word": "ya da",
           "english_word": "or",
           "type": "conj",
           "turkish_sentence": "Mezuniyette mavi ya da siyah bir elbise tercih edebilirsiniz.",
           "english_sentence": "You can choose between the blue or black dress for the graduation."
        },
        {
           "id": 575,
           "turkish_word": "üye",
           "english_word": "member",
           "type": "n",
           "turkish_sentence": "Meclis üye si bu teklifi reddetti.",
           "english_sentence": "The Parliament member declined this offer."
        },
        {
           "id": 576,
           "turkish_word": "ulusal",
           "english_word": "national",
           "type": "adj",
           "turkish_sentence": "Maç öncesi ulusal marş okunuyor.",
           "english_sentence": "Before the match, the national anthem is playing."
        },
        {
           "id": 577,
           "turkish_word": "polis",
           "english_word": "police",
           "type": "n",
           "turkish_sentence": "Çantamı çalan hırsızı polis yakaladı.",
           "english_sentence": "Police caught the thief who stole my bag."
        },
        {
           "id": 578,
           "turkish_word": "müzik",
           "english_word": "music",
           "type": "n",
           "turkish_sentence": "Müzik dinlemeyi her şeyden çok seviyorum.",
           "english_sentence": "I love listening to music more than anything."
        },
        {
           "id": 579,
           "turkish_word": "yapılması",
           "english_word": "to do",
           "type": "ptcp",
           "turkish_sentence": "Yapılması gerekenler panoda asılı duruyor.",
           "english_sentence": "Things to do are hung on the board."
        },
        {
           "id": 580,
           "turkish_word": "yaşanan",
           "english_word": "happening",
           "type": "ptcp",
           "turkish_sentence": "Yaşanan kötü olaylardan sonra biraz dinlenmeye ihtiyacım var.",
           "english_sentence": "After the bad events happening, I need to rest."
        },
        {
           "id": 581,
           "turkish_word": "peki",
           "english_word": "all right",
           "type": "prep",
           "turkish_sentence": "Peki ya şimdi ne olacak?",
           "english_sentence": "All right then, what's going to happen now?"
        },
        {
           "id": 582,
           "turkish_word": "vermek",
           "english_word": "give",
           "type": "v",
           "turkish_sentence": "Zeynep’e bir mandalina verdim.",
           "english_sentence": "I gave a mandarin to Zeynep."
        },
        {
           "id": 583,
           "turkish_word": "ülkenin",
           "english_word": "country's",
           "type": "n",
           "turkish_sentence": "Orman yangınları ülkenin gündeminde.",
           "english_sentence": "Forest fires are in the country's agenda."
        },
        {
           "id": 584,
           "turkish_word": "günlük",
           "english_word": "daily",
           "type": "adj",
           "turkish_sentence": "Günlük cilt bakımını yapmayı unutma.",
           "english_sentence": "Don't forget to do your daily skin care."
        },
        {
           "id": 585,
           "turkish_word": "değer",
           "english_word": "value",
           "type": "n",
           "turkish_sentence": "Sen de benim değer verdiğim kişiler arasındasın.",
           "english_sentence": "You are also among the people I value."
        },
        {
           "id": 586,
           "turkish_word": "mart",
           "english_word": "March",
           "type": "n",
           "turkish_sentence": "Doğum günüm mart ayında.",
           "english_sentence": "My birthday is in March."
        },
        {
           "id": 587,
           "turkish_word": "yeterli",
           "english_word": "enough",
           "type": "adj",
           "turkish_sentence": "Bu kadarı benim için yeterli.",
           "english_sentence": "This much is enough for me."
        },
        {
           "id": 588,
           "turkish_word": "kullanılan",
           "english_word": "used",
           "type": "ptcp",
           "turkish_sentence": "Bu yemekte kullanılan malzemeleri söyler misiniz?",
           "english_sentence": "Can you tell me the ingredients used in this meal?"
        },
        {
           "id": 589,
           "turkish_word": "merkez",
           "english_word": "center",
           "type": "n",
           "turkish_sentence": "Evimiz şehir merkez ine on dakikalık uzaklıktaydı.",
           "english_sentence": "Our house was ten minutes away from the city center."
        },
        {
           "id": 590,
           "turkish_word": "sonrası",
           "english_word": "after",
           "type": "adv",
           "turkish_sentence": "Kurs sonrası nda ne yapacağımı bilmiyorum.",
           "english_sentence": "I don't know what I can do after this course."
        },
        {
           "id": 591,
           "turkish_word": "ilgi",
           "english_word": "care",
           "type": "n",
           "turkish_sentence": "Kızımın ilgi ye ihtiyacı olduğunu fark ettim.",
           "english_sentence": "I realized that my daughter needs care."
        },
        {
           "id": 592,
           "turkish_word": "madde",
           "english_word": "matter",
           "type": "n",
           "turkish_sentence": "Madde nin üç hali vardır.",
           "english_sentence": "Matter has three states."
        },
        {
           "id": 593,
           "turkish_word": "beş",
           "english_word": "five",
           "type": "adj",
           "turkish_sentence": "Saat beş te uyanacağım.",
           "english_sentence": "I will wake up at five."
        },
        {
           "id": 594,
           "turkish_word": "yer",
           "english_word": "place",
           "type": "n",
           "turkish_sentence": "Burada gösterilen yer i nasıl bulabilirim?",
           "english_sentence": "How can I find the place that is shown here?"
        },
        {
           "id": 595,
           "turkish_word": "ürün",
           "english_word": "product",
           "type": "n",
           "turkish_sentence": "Bu ürün ü de almak istiyorum.",
           "english_sentence": "I want to buy this product too."
        },
        {
           "id": 596,
           "turkish_word": "araştırma",
           "english_word": "research",
           "type": "n",
           "turkish_sentence": "Bu konula ilgili araştırma yı sen yapacaksın.",
           "english_sentence": "You will conduct the research about this topic."
        },
        {
           "id": 597,
           "turkish_word": "belirtti",
           "english_word": "indicated",
           "type": "v",
           "turkish_sentence": "Bu tarzdan hiç hoşnut olmadığını açıkça belirtti.",
           "english_sentence": "He clearly indicated that he didn't like this style."
        },
        {
           "id": 598,
           "turkish_word": "senin",
           "english_word": "your",
           "type": "pron",
           "turkish_sentence": "Senin kedin çok tatlı.",
           "english_sentence": "Your cat is so sweet."
        },
        {
           "id": 599,
           "turkish_word": "ses",
           "english_word": "sound",
           "type": "n",
           "turkish_sentence": "Arka odadan bir ses geliyor.",
           "english_sentence": "There is a sound coming from the back room."
        },
        {
           "id": 600,
           "turkish_word": "yıllarda",
           "english_word": "years",
           "type": "adv",
           "turkish_sentence": "Son yıllarda suç oranları arttı.",
           "english_sentence": "In the last years the crime rates have increased."
        },
        {
           "id": 601,
           "turkish_word": "yıllarda",
           "english_word": "in",
           "type": "postp",
           "turkish_sentence": "O yıllarda henüz çok genç yaşta ve tecrübesiz olduğum için neyin doğru neyin yanlış olduğunu ayırt edemiyordum.",
           "english_sentence": "Because in those years I was so young and inexperienced, I couldn't figure out what was right or wrong.",
           "notes": "these/those"
        },
        {
           "id": 602,
           "turkish_word": "size",
           "english_word": "to you/for you",
           "type": "prep",
           "turkish_sentence": "Bu şehirde doğmuş ve bütün ömrünü burada geçirmiş biri olarak size rehber olmak benim için bir zevktir.",
           "english_sentence": "As a person who was born and spent his whole life in this city, being a guide to you would be my pleasure."
        },
        {
           "id": 603,
           "turkish_word": "sabah",
           "english_word": "morning",
           "type": "adv",
           "turkish_sentence": "Her sabah kahvaltı yapamasam da bir bardak kahve içmeden güne başlamam.",
           "english_sentence": "Even though I can't have breakfast every morning, I never start the day without drinking a cup of coffee."
        },
        {
           "id": 604,
           "turkish_word": "din",
           "english_word": "religion",
           "type": "n",
           "turkish_sentence": "Dünya üzerinde yüzlerce din olmasına rağmen en yaygın dinler Hıristiyanlık ve İslam'dır.",
           "english_sentence": "Although there are hundreds of religions in the world, Christianity and Islam are the most common religions."
        },
        {
           "id": 605,
           "turkish_word": "sanat",
           "english_word": "art",
           "type": "n",
           "turkish_sentence": "Küçüklüğünden beri çizim ve tasarımla ilgilendiği için liseyi sanat okulunda okumak istedi ancak ailesini ikna etmek pek kolay olmadı.",
           "english_sentence": "She wanted to study art in high school because ever since she was young she was interested in drawing and design, yet it wasn't so easy to convince her family."
        },
        {
           "id": 606,
           "turkish_word": "okulda",
           "english_word": "at the school",
           "type": "adv",
           "turkish_sentence": "Pazartesi günü okulda toplantı var.",
           "english_sentence": "There is a metting at the school on Monday."
        },
        {
           "id": 607,
           "turkish_word": "önüne",
           "english_word": "in front of",
           "type": "postp",
           "turkish_sentence": "Arabayı evin önüne park ettikten sonra hızlıca camlarını silip evine girdi.",
           "english_sentence": "After he parked the car in front of the house, he cleaned its windows fast and got his home."
        },
        {
           "id": 608,
           "turkish_word": "edecek",
           "english_word": "will",
           "type": "ptcp",
           "turkish_sentence": "Bütün evi temizlemede bana yardım edecek birine ihtiyacım var ama kimseyi bulamıyorum.",
           "english_sentence": "I need someone who will help me clean the whole house, but I can't find anyone.",
           "notes": "do something"
        },
        {
           "id": 609,
           "turkish_word": "dolar",
           "english_word": "dollar",
           "type": "n",
           "turkish_sentence": "Yurtdışına çıkmak istiyorsan Türk Lirası değil dolar biriktirmelisin çünkü döviz kurları birbirinden çok farklı.",
           "english_sentence": "If you want to go abroad, you should save dollars instead of Turkish Liras, as the currencies are so different from each other."
        },
        {
           "id": 610,
           "turkish_word": "belirterek",
           "english_word": "indicating",
           "type": "ptcp",
           "turkish_sentence": "Her zaman bir gün sona ereceğini belirterek beni ayrılığa alıştırmaya çalışıyordu.",
           "english_sentence": "He was always trying to accustom me to the breakup by indicating that one day it would end."
        },
        {
           "id": 611,
           "turkish_word": "bölge",
           "english_word": "territory, region",
           "type": "n",
           "turkish_sentence": "Her bitkinin yetişebildiği bölge birbirinden farklıdır; örneğin zeytin ağacı Akdeniz ve Ege Bölge si’nde yetişebilir çünkü neme ve ilik bir iklime ihtiyacı vardır.",
           "english_sentence": "Every plant can be grown in a different territory ; for example, olive trees can be grown in Aegean and Mediterranean regions because they need warm and humid climates."
        },
        {
           "id": 612,
           "turkish_word": "çözüm",
           "english_word": "solution",
           "type": "n",
           "turkish_sentence": "Saatlerdir bu problem üzerinde çalışmama rağmen henüz bir çözüm bulamadım.",
           "english_sentence": "Even though I have been studying on this problem for hours, I still haven’t found a solution yet."
        },
        {
           "id": 613,
           "turkish_word": "dönem",
           "english_word": "period",
           "type": "n",
           "turkish_sentence": "Okulun sonbahar dönem inde derslerime dikkat etmediğim için ikinci dönem çok çalışsam da ortalamam yüksek gelmedi.",
           "english_sentence": "As I didn't pay much attention in my classes in the first school period, I couldn't get a high GPA despite studying hard in the second period."
        },
        {
           "id": 614,
           "turkish_word": "yerel",
           "english_word": "local",
           "type": "adj",
           "turkish_sentence": "Meyve ve sebze alışverişi yaparken elimden geldiğince yerel ürünleri satın almaya çalışıyorum.",
           "english_sentence": "When I am doing groceries of vegetables and fruits, I try to buy local products as much as I can."
        },
        {
           "id": 615,
           "turkish_word": "batı",
           "english_word": "west",
           "type": "n",
           "turkish_sentence": "Türkiye'nin batı sına doğru gidildikçe iklim daha da ılımanlaşır ve yeşil alan artar.",
           "english_sentence": "As one goes to the west of Turkey, the climate becomes more humid and the green space increases."
        },
        {
           "id": 616,
           "turkish_word": "işe",
           "english_word": "to work",
           "type": "prep",
           "turkish_sentence": "Yarın işe gitmek istemiyorum ancak bunun için güzel bir bahane bulmalıyım.",
           "english_sentence": "I don't want to go to work tomorrow but I need to find a good excuse for it."
        },
        {
           "id": 617,
           "turkish_word": "araya",
           "english_word": "between",
           "type": "adv",
           "turkish_sentence": "İki kişi konuşurken araya girmek kaba bir davranıştır.",
           "english_sentence": "Intervening between two people when they talk is a rude behavior."
        },
        {
           "id": 618,
           "turkish_word": "uzak",
           "english_word": "away",
           "type": "adj",
           "turkish_sentence": "Üniversite hayatı boyunca ailesinden yüzlerce kilometre uzak bir ülkede okumak zorunda kaldı.",
           "english_sentence": "He had to study in a country that is hundreds of kilometers away from his family during his years in university."
        },
        {
           "id": 619,
           "turkish_word": "sorunu",
           "english_word": "",
           "type": "n",
           "turkish_sentence": "Benimle sorunu ne bilmiyorum ama bana karşı olan bu davranışları hiç hoşuma bitmiyor.",
           "english_sentence": "I don't know what's his problem with me, but I don't like his actions towards me.",
           "notes": "someone's"
        },
        {
           "id": 620,
           "turkish_word": "yasal",
           "english_word": "legal",
           "type": "adv",
           "turkish_sentence": "Türkiye’de insanlar on sekiz yaşına bastığında yasal olarak yetişkin olurlar.",
           "english_sentence": "In Turkey, people legally become adults when they turn eighteen."
        },
        {
           "id": 621,
           "turkish_word": "ekim",
           "english_word": "October",
           "type": "n",
           "turkish_sentence": "Birçok üniversitenin eylül ayında başlamasına rağmen benim üniversitem her zaman ekim ayında başlar.",
           "english_sentence": "Although most other universities start in September, my university always starts in October."
        },
        {
           "id": 622,
           "turkish_word": "iddia",
           "english_word": "claim",
           "type": "n",
           "turkish_sentence": "İddia ediyoruz ki bu kadar lezzetli bir peyniri başka bir yerde bulamazsınız!",
           "english_sentence": "We claim you can never find any other cheese that is more delicious than this one!"
        },
        {
           "id": 623,
           "turkish_word": "kaldı",
           "english_word": "left",
           "type": "v",
           "turkish_sentence": "Çabuk olsan iyi olur çünkü testi bitirmek için sadece 15 dakikan kaldı.",
           "english_sentence": "You had better hurry because you have only fifteen minutes left to finish your test."
        },
        {
           "id": 624,
           "turkish_word": "bilim",
           "english_word": "science",
           "type": "n",
           "turkish_sentence": "Yirmi birinci yüzyıl bilim çağı olarak nitelendirilebilir çünkü bu süre boyunca bilim sayesinde hayatımıza bircok yenilik girdi.",
           "english_sentence": "The twenty-first century can be regarded as the century of science, as so many innovations have come into our lives during this time thanks to science."
        },
        {
           "id": 625,
           "turkish_word": "kocam",
           "english_word": "my husband",
           "type": "n",
           "turkish_sentence": "Kocam emekli olduktan sonra küçük bir kasabaya taşındık.",
           "english_sentence": "After my husband retired, we moved to a small town."
        },
        {
           "id": 626,
           "turkish_word": "normal",
           "english_word": "normal",
           "type": "adj",
           "turkish_sentence": "Siyah çamaşırların yıkanması için normal su sıcaklığı 40° civarıdır ancak beyaz çamaşırlar için normal sıcaklık 90°'ye kadar çıkabilir.",
           "english_sentence": "Normal water temparature for washing black clothes is around 40°C but for white clothes it can be up to 90°C."
        },
        {
           "id": 627,
           "turkish_word": "toplumsal",
           "english_word": "social",
           "type": "adj",
           "turkish_sentence": "Günümüzde hâlâ sosyal baskı altında kalan birçok kız çocuğu eğitimine devam etmek yerine evinde kapalı kalmak zorunda kalıyor.",
           "english_sentence": "Today, so many girls still have to stay at home instead of continuing their studies because of the social pressure."
        },
        {
           "id": 628,
           "turkish_word": "sana",
           "english_word": "to you",
           "type": "prep",
           "turkish_sentence": "Sana göre önemsiz görünebilir ama benim icin çok önemli bir konu olduğu için anlayışlı olmanı bekliyorum.",
           "english_sentence": "It may seem unimportant to you, but it is important for me, so I expect you to be considerate."
        },
        {
           "id": 629,
           "turkish_word": "benzer",
           "english_word": "similar",
           "type": "adj",
           "turkish_sentence": "Başına geleni duyduğuma çok üzüldüm, ama benim tavsiyem, akşam geç saatte o mahalleden geçmemeye dikkat et; çünkü benzer bir başka olay da birkaç gün önce benim başıma gelmişti.",
           "english_sentence": "I am so sorry to hear what happened to you, but my advice is to try not to walk in that neighborhood because a similar incident also happened to me a few days ago."
        },
        {
           "id": 630,
           "turkish_word": "-li",
           "english_word": "from/with",
           "type": "postp",
           "turkish_sentence": "İstanbul'da doğup büyüdüm ancak aslen Mersinli yim.",
           "english_sentence": "I was born and raised in Istanbul, but originally, I am from Mersin."
        },
        {
           "id": 631,
           "turkish_word": "öğrenci",
           "english_word": "student",
           "type": "n",
           "turkish_sentence": "Ankara'da öğrenci nüfusu yüksektir, çünkü Türkiye'nin en iyi üniversiteleri bu şehirdedir.",
           "english_sentence": "Student population in Ankara is high because the best universities in Turkey are in this city."
        },
        {
           "id": 632,
           "turkish_word": "Kemal",
           "english_word": "Kemal",
           "type": "n",
           "turkish_sentence": "Türkiye Cumhuriyeti'nin kurucusu Mustafa Kemal Atatürk'tür.",
           "english_sentence": "The founder of the Republic of Turkey is Mustafa Kemal Atatürk.",
           "notes": "a male name in Turkey"
        },
        {
           "id": 633,
           "turkish_word": "yazı",
           "english_word": "writing",
           "type": "n",
           "turkish_sentence": "El yazı sından bu notu kimin yazdığını tahmin edebiliyorum.",
           "english_sentence": "I can guess who wrote this note from their handwriting."
        },
        {
           "id": 634,
           "turkish_word": "çalışmaları",
           "english_word": "studies of/on",
           "type": "n poss",
           "turkish_sentence": "Uluslararası İlişkiler bölümünü bitirdikten sonra “Asya Çalışmaları ” adlı yüksek lisans programına başlamak istiyorum.",
           "english_sentence": "I want to start the master program 'Asian Studies ' after finishing my International Relations major."
        },
        {
           "id": 635,
           "turkish_word": "sanki",
           "english_word": "as if",
           "type": "conj",
           "turkish_sentence": "Dün akşamki davranışlarından sanki bana karşı kırgınmış gibi hissettim, ama onunla konuşsam mı bilemiyorum.",
           "english_sentence": "I felt as if she was offended by me from her behavior last night, but I don't know if I should talk to her or not."
        },
        {
           "id": 636,
           "turkish_word": "Çin",
           "english_word": "China",
           "type": "n",
           "turkish_sentence": "Çin 'in yakın gelecekte dünya çapında çok güçlü bir ülke olacağı düşünüldüğü için birçok kişi Çince öğrenmeye başladı.",
           "english_sentence": "As it is thought that China will be a very powerful country in the world, many people have started to learn Chinese."
        },
        {
           "id": 637,
           "turkish_word": "çevre",
           "english_word": "environment",
           "type": "n",
           "turkish_sentence": "Son zamanlarda çevre kirliliği sorunu ciddileştiği için birçok kişi tarafından çeşitli eylemlerle protesto edilip farkındalık yaratılmaya çalışılıyor.",
           "english_sentence": "Since the problem about environment pollution is getting serious lately, it is being protested by so many people to raise awareness."
        },
        {
           "id": 638,
           "turkish_word": "anne",
           "english_word": "mother",
           "type": "n",
           "turkish_sentence": "Geçmişte on sekiz yaşında anne olmak normal karşılandıysa bile günümüzde çocuk sahibi olmak için çok genç yaş olarak sayılır.",
           "english_sentence": "Although in the past being a mother at the age of eighteen was seen as normal, today it is regarded as a very young age to have a child."
        },
        {
           "id": 639,
           "turkish_word": "ünlü",
           "english_word": "famous",
           "type": "adj",
           "turkish_sentence": "Türkiye'deki birçok ünlü yazar ve düşünür, zamanının çoğunu İstanbul'da geçirdiği için eserlerinin üzerinde İstanbul'un etkisi büyüktür.",
           "english_sentence": "As so many famous writers and philosophers in Turkey have lived in Istanbul for most of their times, the effect of Istanbul is huge on their works."
        },
        {
           "id": 640,
           "turkish_word": "kapsamında",
           "english_word": "within",
           "type": "postp",
           "turkish_sentence": "Halen garanti kapsamında olduğu için ücretsiz olarak tamir ettirebilirsiniz.",
           "english_sentence": "Because it is still within guarantee, you can get it fixed for free.",
           "notes": "the scope of"
        },
        {
           "id": 641,
           "turkish_word": "dair",
           "english_word": "about",
           "type": "adv",
           "turkish_sentence": "Yarınki seminerde eğitime dair ne varsa konuşup tartışacağız.",
           "english_sentence": "We will talk and discuss everything about education in tomorrow's seminar."
        },
        {
           "id": 642,
           "turkish_word": "etkili",
           "english_word": "effective",
           "type": "adj",
           "turkish_sentence": "Ağır bir soğuk algınlığı geçirdiğim için çabuk etkili bir ilaç kullanmak istiyorum.",
           "english_sentence": "I want to use a quick effective medicine because I have a serious flu."
        },
        {
           "id": 643,
           "turkish_word": "zarar",
           "english_word": "damage",
           "type": "n",
           "turkish_sentence": "Dün geceki kazada arabanın büyük zarar görmesine rağmen en azından ciddi yaralı olmadığı için şanslıydık.",
           "english_sentence": "Even though the car had huge damage from yesterday night's accident, we were lucky there were no seriously injured victims."
        },
        {
           "id": 644,
           "turkish_word": "sırada",
           "english_word": "in the line",
           "type": "adv",
           "turkish_sentence": "Yarınki konsere bilet almak için neredeyse 3 saattir sırada bekliyorum, ama artık çok yorgun hissediyorum.",
           "english_sentence": "I have been waiting in the line for almost 3 hours to buy the tickets for tomorrow's concert, but I feel so tired now."
        },
        {
           "id": 645,
           "turkish_word": "edilmesi",
           "english_word": "be done +",
           "type": "ptcp",
           "turkish_sentence": "Bu kadar çaba ve zaman harcadığı için en çok şefimize teşekkür edilmesi gerek.",
           "english_sentence": "As he has spent so much effort and time, he should be thanked the most.",
           "notes": "verb-3"
        },
        {
           "id": 646,
           "turkish_word": "kararı",
           "english_word": "decision",
           "type": "n poss",
           "turkish_sentence": "Mahkeme kararı na göre iki çocuğun velayeti anneye verildi, ancak babanın da görüş hakkı olmasında sakınca görülmedi.",
           "english_sentence": "According to the Court decision, the custody of the two children was given to the mother, yet there was no opposition against the father to not give him a right to see them."
        },
        {
           "id": 647,
           "turkish_word": "oy",
           "english_word": "vote",
           "type": "n",
           "turkish_sentence": "Demokrasiye göre ulusal seçimlerde 18 yaşı ve üzeri her T.C. vatandaşının oy kullanmaya hakkı vardır.",
           "english_sentence": "According to democracy, every T.C. citizen who is 18 or older has the right to cast their vote in the national elections."
        },
        {
           "id": 648,
           "turkish_word": "soru",
           "english_word": "question",
           "type": "n",
           "turkish_sentence": "Annemden duydum ki çocukken çok soru soranlardanmışım ben de.",
           "english_sentence": "As I heard from my mother, I was one of those kids who asked too many questions."
        },
        {
           "id": 649,
           "turkish_word": "anlamda",
           "english_word": "kind of",
           "type": "adj",
           "turkish_sentence": "Ne anlamda bir ilişkiden bahsedebilirim bilmiyorum ama bir şeyler hissediyorum.",
           "english_sentence": "I don't know what kind of relationship I can talk about, but I feel something."
        },
        {
           "id": 650,
           "turkish_word": "düşük",
           "english_word": "low",
           "type": "adj",
           "turkish_sentence": "Patronum son zamanlarda bazı çalışanlardan düşük verim aldığı için onları işten çıkarmayı düşünüyor.",
           "english_sentence": "My boss is thinking about firing some of his employees because he's having low productivity from them nowadays."
        },
        {
           "id": 651,
           "turkish_word": "ayında",
           "english_word": "in",
           "type": "prep",
           "turkish_sentence": "İşe ocak ayında başlamıştım ancak daha fazla devam etmek istemediğim için haziran ayında ayrıldım.",
           "english_sentence": "I started the job in the month of January, but I quit in the month of June as I didn't want to continue anymore.",
           "notes": "on) the month (of"
        },
        {
           "id": 652,
           "turkish_word": "dakika",
           "english_word": "minute",
           "type": "n",
           "turkish_sentence": "Her gün okula gitmek için 30 dakika yürümek zorundayım çünkü herhangi bir otobüs hattı yok.",
           "english_sentence": "Every day I have to walk 30 minutes to go to school because there is no bus route.",
           "notes": "s"
        },
        {
           "id": 653,
           "turkish_word": "ocak",
           "english_word": "January",
           "type": "n",
           "turkish_sentence": "Ocak ayı yılın ilk ayıdır.",
           "english_sentence": "January is the first month of the year."
        },
        {
           "id": 654,
           "turkish_word": "biçimde",
           "english_word": "in the way that",
           "type": "adv",
           "turkish_sentence": "Annem her zaman bir şey yapıyorsan daima en iyi sonucu alacak biçimde yap der.",
           "english_sentence": "My mother always says whatever you do, always do it in the way that can give you the best result."
        },
        {
           "id": 655,
           "turkish_word": "bebeği",
           "english_word": "the baby",
           "type": "n",
           "turkish_sentence": "Yaşlı kadın bebeği beşiğine koydu.",
           "english_sentence": "The old lady put the baby in his crib."
        },
        {
           "id": 656,
           "turkish_word": "anayasa",
           "english_word": "constitution",
           "type": "n",
           "turkish_sentence": "Son günlerde mecliste, yeni anayasa değişikliği tartışılıyor.",
           "english_sentence": "A new change in constitution is being discussed in the parliament nowadays."
        },
        {
           "id": 657,
           "turkish_word": "sivil",
           "english_word": "civilian",
           "type": "n",
           "turkish_sentence": "Türkiye'nin bağımsızlık savaşında askerlerle birlikte birçok sivil de ülkesi için savaştı.",
           "english_sentence": "Many civilians fought for their country with the soldiers during Turkey's independence war."
        },
        {
           "id": 658,
           "turkish_word": "herkesin",
           "english_word": "everybody's",
           "type": "adj",
           "turkish_sentence": "Güven ve refah içinde yaşamak herkesin hakkıdır.",
           "english_sentence": "Living in safety and wellness is everybody's right."
        },
        {
           "id": 659,
           "turkish_word": "derneği",
           "english_word": "organization of",
           "type": "n",
           "turkish_sentence": "İşçi Derneği 1 Mayıs'ta İşçi Bayramı için büyük bir protesto yapmayı planlıyor.",
           "english_sentence": "Labour Organization is planning to make a big protest for the Labor Day on the 1st of May."
        },
        {
           "id": 660,
           "turkish_word": "nedir",
           "english_word": "what",
           "type": "pron",
           "turkish_sentence": "Hayatında duyduğun en büyük pişmanlık nedir ?",
           "english_sentence": "What is the biggest regret you have in your life?",
           "notes": "is it"
        },
        {
           "id": 661,
           "turkish_word": "ihtiyaç",
           "english_word": "need",
           "type": "n",
           "turkish_sentence": "Anne ve baba çocuklarının en azından en temel ihtiyaç larını karşılayabiliyor olmalıdır.",
           "english_sentence": "A mother and father should be able to meet their children's basic needs, at least."
        },
        {
           "id": 662,
           "turkish_word": "akşam",
           "english_word": "night",
           "type": "adv",
           "turkish_sentence": "Genelde akşam saat 11 civarında trafik çok sakin olur.",
           "english_sentence": "Usually the traffic is very calm around 11 o'clock at night."
        },
        {
           "id": 663,
           "turkish_word": "düşünüyorum",
           "english_word": "I'm thinking",
           "type": "v",
           "turkish_sentence": "Son günlerde kariyerimde doğru seçimi yapabildim mi diye düşünüyorum\r.",
           "english_sentence": "Lately, I'm thinking if I could make a good decision in my career life."
        },
        {
           "id": 664,
           "turkish_word": "olma",
           "english_word": "occurrence",
           "type": "n",
           "turkish_sentence": "Problem olma halinde en kısa zamanda beni bilgilendirirseniz yardımcı olurum.",
           "english_sentence": "I would help you if you let me know immediately in case of the occurrence of a problem."
        },
        {
           "id": 665,
           "turkish_word": "sanayi",
           "english_word": "industry",
           "type": "n",
           "turkish_sentence": "Sanayi ürünü kıyafetler özel tasarım kıyafetlere göre daha uygun fiyatlıdır.",
           "english_sentence": "Industry produced clothes have more reasonable prices than custom design clothes."
        },
        {
           "id": 666,
           "turkish_word": "öncelikle",
           "english_word": "first of all",
           "type": "adv",
           "turkish_sentence": "Toplantımızda öncelikle bu konu hakkında konuşmak isterim.",
           "english_sentence": "First of all, I would like to talk about this topic at our meeting."
        },
        {
           "id": 667,
           "turkish_word": "yalnız",
           "english_word": "alone",
           "type": "adj",
           "turkish_sentence": "Üniversitenin ilk yılında yalnız olmama rağmen sonraki yıllarda birçok arkadaş edindim.",
           "english_sentence": "Although I was alone in the university in my first year, I got many new friends in the next years."
        },
        {
           "id": 668,
           "turkish_word": "doğu",
           "english_word": "east",
           "type": "n",
           "turkish_sentence": "Doğu Ekspresi ile Türkiye'nin batısından doğu suna kadar trenle gidebilirsiniz.",
           "english_sentence": "You can go from west to the east of Turkey by train with East Express."
        },
        {
           "id": 669,
           "turkish_word": "tespit",
           "english_word": "detection",
           "type": "n",
           "turkish_sentence": "Bu kadar az veriden tespit yapmak çok zor.",
           "english_sentence": "It's too hard to make a detection from so little data."
        },
        {
           "id": 670,
           "turkish_word": "dil",
           "english_word": "language",
           "type": "n",
           "turkish_sentence": "6 yaşında olmasına rağmen 3 farklı dil de konuşabiliyor.",
           "english_sentence": "Although he is six years old, he can speak three different languages."
        },
        {
           "id": 671,
           "turkish_word": "Müslüman",
           "english_word": "Muslim",
           "type": "n",
           "turkish_sentence": "Türkiye'deki nüfusun büyük bir çoğunluğu Müslüman’ dır.",
           "english_sentence": "A big majority of Turks are Muslims."
        },
        {
           "id": 672,
           "turkish_word": "meclis",
           "english_word": "parliament",
           "type": "n",
           "turkish_sentence": "Türk meclis i vatandaşların seçimleriyle oluşturulmuştur.",
           "english_sentence": "The Turkish Parliament is formed by the votes of the citizens."
        },
        {
           "id": 673,
           "turkish_word": "can",
           "english_word": "life",
           "type": "n",
           "turkish_sentence": "Oyundaki üç can dan ikisini ilk dakikada kaybettim.",
           "english_sentence": "I lost two out of my three lives in a minute."
        },
        {
           "id": 674,
           "turkish_word": "sayıda",
           "english_word": "number of",
           "type": "adj",
           "turkish_sentence": "2010 yılındaki büyük depremde birçok sayıda insan hayatını kaybetti.",
           "english_sentence": "A great number of people lost their lives in the big 2010 earthquake."
        },
        {
           "id": 675,
           "turkish_word": "elbette",
           "english_word": "of course",
           "type": "adv",
           "turkish_sentence": "Elbette istersen o üniversiteye kabul edilebilirsin, tek yapman gereken kendine inanmak!",
           "english_sentence": "Of course, you can be accepted to that university if you want it, all you need to do is believe in yourself!"
        },
        {
           "id": 676,
           "turkish_word": "önem",
           "english_word": "importance",
           "type": "n",
           "turkish_sentence": "Geleceğine yeteri kadar önem vermezsen hiçbir şey başaramazsın.",
           "english_sentence": "If you don't place importance on your future you can never succeed at anything."
        },
        {
           "id": 677,
           "turkish_word": "PKK",
           "english_word": "PKK",
           "type": "n",
           "turkish_sentence": "PKK ile ilişkisi olan resmi ve özel kurumlara hukuki işlem başlatıldı.",
           "english_sentence": "A legal act was applied for the official and private organizations that are related to PKK.",
           "notes": "a terrorist group in Turkey"
        },
        {
           "id": 678,
           "turkish_word": "sayılı",
           "english_word": "limited",
           "type": "adj",
           "turkish_sentence": "Bu çok özel bir gösteri olduğu icin biletler sayılı.",
           "english_sentence": "As this is a very special show, the tickets are limited."
        },
        {
           "id": 679,
           "turkish_word": "asla",
           "english_word": "never",
           "type": "adv",
           "turkish_sentence": "Bir daha asla bu yurtta kalmayacağım!",
           "english_sentence": "I will never stay in this dormitory again!"
        },
        {
           "id": 680,
           "turkish_word": "pazar",
           "english_word": "Sunday",
           "type": "n",
           "turkish_sentence": "Pazar akşamları genelde sakindir çünkü birçok insan yeni bir hafta için hazırlanmakla meşguldür.",
           "english_sentence": "Sunday nights are usually quiet because many people are busy with getting prepared for the new week."
        },
        {
           "id": 681,
           "turkish_word": "sistem",
           "english_word": "system",
           "type": "n",
           "turkish_sentence": "Satın alalı 2 yıl olmasına rağmen bu bilgisayarın çalışma sistem ini bir türlü anlayamadım.",
           "english_sentence": "Even though it's been 2 years since I bought it, I can't understand the operating system of this computer."
        },
        {
           "id": 682,
           "turkish_word": "futbol",
           "english_word": "football",
           "type": "n",
           "turkish_sentence": "Futbol Türkiye'deki en popüler spor olarak görülür çünkü herkesin desteklediği bir futbol takımı vardır.",
           "english_sentence": "Football is seen as the most popular sport of Turkey, as everyone supports a football team."
        },
        {
           "id": 683,
           "turkish_word": "döneminde",
           "english_word": "in the period",
           "type": "postp",
           "turkish_sentence": "Osmanlı döneminde birçok farklı millet tek bir imparatorluk altında yaşıyordu.",
           "english_sentence": "In the period of Ottoman, many different nationalities were living under the same empire."
        },
        {
           "id": 684,
           "turkish_word": "günlerde",
           "english_word": "in days of...",
           "type": "adv",
           "turkish_sentence": "Güneşli günlerde insanlar daha aktif olurlar çünkü kış günlerinden daha sık dışarı çıkarlar.",
           "english_sentence": "In days of sunny weather, people are more active as they go out more often than winter."
        },
        {
           "id": 685,
           "turkish_word": "tan",
           "english_word": "twilight",
           "type": "n",
           "turkish_sentence": "Tan vakti yıldızları izlemekten çok hoşlanırım.",
           "english_sentence": "I like to watch the stars during twilight."
        },
        {
           "id": 686,
           "turkish_word": "asıl",
           "english_word": "real",
           "type": "adj",
           "turkish_sentence": "İşin asıl zor yanı, zor durumda karşılaştığında nasıl davranacağını bilememek.",
           "english_sentence": "The real challenge is when you’re faced with a hard situation and don't know how to act."
        },
        {
           "id": 687,
           "turkish_word": "işçi",
           "english_word": "worker",
           "type": "n",
           "turkish_sentence": "Şirket barındırdığı personel sayısını düşürünce birçok işçi bu durumu protesto etti.",
           "english_sentence": "When the company reduced the number of its employees, lots of workers protested this situation."
        },
        {
           "id": 688,
           "turkish_word": "halkın",
           "english_word": "of the public",
           "type": "n",
           "turkish_sentence": "Politikacılar her zaman halkın güvenini kazanmanın bir yolunu bulur.",
           "english_sentence": "Politicians always find a way to get the trust of the public."
        },
        {
           "id": 689,
           "turkish_word": "haziran",
           "english_word": "June",
           "type": "n",
           "turkish_sentence": "Haziran ayı yaz tatilinin başlangıcı olarak görülür.",
           "english_sentence": "June is seen as the start of summer vacation."
        },
        {
           "id": 690,
           "turkish_word": "dahi",
           "english_word": "genius",
           "type": "n",
           "turkish_sentence": "Bu defiledeki kıyafetleri kim tasarladıysa kesinlikle bir dahi olmalı.",
           "english_sentence": "Whoever designed the clothes from this fashion show must definitely be a genius."
        },
        {
           "id": 691,
           "turkish_word": "değerli",
           "english_word": "precious",
           "type": "adj",
           "turkish_sentence": "Seni çok değerli arkadaşım Buse ile tanıştırmak istiyorum, kendisini çocukluktan beri tanırım.",
           "english_sentence": "I want to introduce you to my precious friend Buse, I know her since our childhood."
        },
        {
           "id": 692,
           "turkish_word": "meslek",
           "english_word": "occupation",
           "type": "n",
           "turkish_sentence": "O kadar buluşmamıza rağmen, meşgul olduğu meslek nedir diye sormak aklıma gelmedi.",
           "english_sentence": "Although we met so often, I never thought about asking his occupation."
        },
        {
           "id": 693,
           "turkish_word": "nisan",
           "english_word": "April",
           "type": "n",
           "turkish_sentence": "Her yıl 23 Nisan Türkiye Cumhuriyeti'nin Ulusal Egemenlik ve Çocuk Bayramı olarak kabul edilir.",
           "english_sentence": "Every 23rd of April is accepted as the National Sovereignty and Children's Day of the Republic of Turkey."
        },
        {
           "id": 694,
           "turkish_word": "beyaz",
           "english_word": "white",
           "type": "adj",
           "turkish_sentence": "Evin içinde koyu tonları pek sevmiyorum, bu yüzden duvarları beyaz a boyamak istiyorum.",
           "english_sentence": "I do not like dark colors in the house, that's why I want to paint the walls in white."
        },
        {
           "id": 695,
           "turkish_word": "devletin",
           "english_word": "of state",
           "type": "n",
           "turkish_sentence": "Devletin sağladığı hizmetleri kullanmak vatandaş olarak en temel hakkımız.",
           "english_sentence": "As citizens, benefiting from the services of the state is our basic right."
        },
        {
           "id": 696,
           "turkish_word": "sonraki",
           "english_word": "next",
           "type": "adj",
           "turkish_sentence": "Kitabın geri kalanını sonraki haftaya kadar okumuş ve özetini yazmış olun lütfen.",
           "english_sentence": "Please read and write the summary of the rest of the book by next week."
        },
        {
           "id": 697,
           "turkish_word": "unuttum",
           "english_word": "I forgot",
           "type": "v",
           "turkish_sentence": "Bu akşam patronumun yemeğe geleceğini sana söylemeyi unuttum.",
           "english_sentence": "I forgot to tell you that my boss is coming for dinner tonight."
        },
        {
           "id": 698,
           "turkish_word": "internet",
           "english_word": "web/internet",
           "type": "n",
           "turkish_sentence": "Okulumuzun internet sitesinde sınav takvimi de var.",
           "english_sentence": "The exam schedule is written on the school website."
        },
        {
           "id": 699,
           "turkish_word": "diyerek",
           "english_word": "saying",
           "type": "adv",
           "turkish_sentence": "“Her zaman sana göz kulak olacağım,” diyerek neyi kastetmiş olabilir anlayamadım.",
           "english_sentence": "I couldn't get what he wanted to mean by saying \"I will always take care of you,\"."
        },
        {
           "id": 700,
           "turkish_word": "yüz",
           "english_word": "face",
           "type": "n",
           "turkish_sentence": "Yüz ündeki makyaj profesyonel bir makyözün elinden çıkmış gibi görünüyor.",
           "english_sentence": "The makeup on her face looks like a job of a professional makeup artist."
        },
        {
           "id": 701,
           "turkish_word": "hak",
           "english_word": "right",
           "type": "n",
           "turkish_sentence": "İstediğim zaman çocukları görebilmek benim de hak kım.",
           "english_sentence": "Seeing my children whenever I want is also my right."
        },
        {
           "id": 702,
           "turkish_word": "işin",
           "english_word": "your job",
           "type": "n",
           "turkish_sentence": "Yemek yapmak benim işimse, bulaşıkları yıkamak da senin işin.",
           "english_sentence": "If cooking is my job, then washing the dishes is your job."
        },
        {
           "id": 703,
           "turkish_word": "sağlıklı",
           "english_word": "healthy",
           "type": "adj",
           "turkish_sentence": "Yeni yılda sağlıklı, mutlu ve hep bir arada olalım istiyorum.",
           "english_sentence": "I want us to be healthy, happy, and always together in the new year."
        },
        {
           "id": 704,
           "turkish_word": "yıldır",
           "english_word": "for … years",
           "type": "adv",
           "turkish_sentence": "8 yıldır bu evde yaşıyorum ama artık taşınmak istiyorum.",
           "english_sentence": "I have been living in this house for 8 years but now I want to move."
        },
        {
           "id": 705,
           "turkish_word": "adım",
           "english_word": "step",
           "type": "n",
           "turkish_sentence": "Her gün en az on bin adım atmak sağlığa çok faydalıdır.",
           "english_sentence": "Taking at least ten thousand steps everyday is very good for your health."
        },
        {
           "id": 706,
           "turkish_word": "hazır",
           "english_word": "ready",
           "type": "adv",
           "turkish_sentence": "Akşam yemeği hazır olduğunda beni çağırır mısın?",
           "english_sentence": "Can you call me when the dinner is ready ?"
        },
        {
           "id": 707,
           "turkish_word": "kasım",
           "english_word": "November",
           "type": "n",
           "turkish_sentence": "Kasım ayı için planlanan programın dışına çıkmışsınız.",
           "english_sentence": "You are out of the plan prepared for November."
        },
        {
           "id": 708,
           "turkish_word": "ister",
           "english_word": "wants",
           "type": "v",
           "turkish_sentence": "Bir anne çocuğunun mutlu olmasından başka ne ister?",
           "english_sentence": "What else does a mother want, other than wishing her child to be happy?"
        },
        {
           "id": 709,
           "turkish_word": "şehir",
           "english_word": "city",
           "type": "n",
           "turkish_sentence": "2 yıldır bu şehir de yaşıyorum ama artık başka bir şehir denemek istiyorum.",
           "english_sentence": "I've been living in this city for two years but now I want to try a new city."
        },
        {
           "id": 710,
           "turkish_word": "olumlu",
           "english_word": "negative",
           "type": "adj",
           "turkish_sentence": "Bu programın gençler üzerinde olumlu etki yarattığını düşünüyorum.",
           "english_sentence": "I think this program has a negative effect on young people."
        },
        {
           "id": 711,
           "turkish_word": "tane",
           "english_word": "piece",
           "type": "adv",
           "turkish_sentence": "Kahvaltıda bir tane ekmek yedim.",
           "english_sentence": "I ate one piece of bread for breakfast.",
           "notes": "s"
        },
        {
           "id": 712,
           "turkish_word": "öne",
           "english_word": "forward",
           "type": "adv",
           "turkish_sentence": "Bileti okutmak için öne doğru eğilirken yaşlı bir teyzeye çarptım.",
           "english_sentence": "As I leaned forward to enter my ticket, I bumped into an old lady."
        },
        {
           "id": 713,
           "turkish_word": "ara",
           "english_word": "side",
           "type": "adj",
           "turkish_sentence": "Ara sokaklarda akşam saati gezinmek çok da güvenli değil açıkçası.",
           "english_sentence": "Wandering around the side streets is not actually safe."
        },
        {
           "id": 714,
           "turkish_word": "genellikle",
           "english_word": "usually",
           "type": "adv",
           "turkish_sentence": "Kediler genellikle gündüzleri uyumayı severler, bu yüzden sürekli evin rastgele yerlerinde uyuyakalırlar.",
           "english_sentence": "Cats usually like to sleep during the day, which is why they often fall asleep in random places of the house."
        },
        {
           "id": 715,
           "turkish_word": "kendilerine",
           "english_word": "themselves",
           "type": "adv",
           "turkish_sentence": "15 yıldır kirada yaşadıktan sonra nihayet kendilerine ait bir evleri olmuştu.",
           "english_sentence": "After living in a rented house for fifteen years, they finally had a house they owned themselves."
        },
        {
           "id": 716,
           "turkish_word": "net",
           "english_word": "clear",
           "type": "adj",
           "turkish_sentence": "Müşterilere açılış için net bir tarih vermek çok zor çünkü henüz ürünlerin teminatı tamamlanmadı.",
           "english_sentence": "It's too hard to give a clear date for opening because the delivery of the products hasn't been done yet."
        },
        {
           "id": 717,
           "turkish_word": "rahat",
           "english_word": "comfortable",
           "type": "adj",
           "turkish_sentence": "Askerde geçen iki yıldan sonra rahat bir yatakta uyumayı özledim.",
           "english_sentence": "After spending two years in the military, I missed sleeping in a comfortable bed."
        },
        {
           "id": 718,
           "turkish_word": "arasına",
           "english_word": "between",
           "type": "adv",
           "turkish_sentence": "Kitapların arasına senin için bırakmış olduğum notu buldun m?",
           "english_sentence": "Did you find the note I left for you between the books?"
        },
        {
           "id": 719,
           "turkish_word": "ülkede",
           "english_word": "in a/the country",
           "type": "adv",
           "turkish_sentence": "Demokrasi ile yönetilen bir ülkede yaşıyor olmamıza rağmen halen demokrasi karşıtı propagandalar devam ediyor.",
           "english_sentence": "Although we're living in a country that is run by democracy, still there are some anti-democracy propagandas."
        },
        {
           "id": 720,
           "turkish_word": "olması",
           "english_word": "be/being/that it is",
           "type": "ptcp",
           "turkish_sentence": "Bugünün çarşamba olması na rağmen işi teslim ettim.",
           "english_sentence": "Although today is Wednesday, I delivered the work."
        },
        {
           "id": 721,
           "turkish_word": "idi",
           "english_word": "was/were",
           "type": "v",
           "turkish_sentence": "Dün altıncı evlilik yıl dönümümüz idi.",
           "english_sentence": "Yesterday was the sixth-year anniversary of our marriage."
        },
        {
           "id": 722,
           "turkish_word": "demokratik",
           "english_word": "democratic",
           "type": "adj",
           "turkish_sentence": "Türkiye demokratik bir yöntemle yönetilmektedir.",
           "english_sentence": "Turkey is run by a democratic policy."
        },
        {
           "id": 723,
           "turkish_word": "grubu",
           "english_word": "group of",
           "type": "n poss",
           "turkish_sentence": "Küçükken en sevdiğim müzik grubu One Direction’dı.",
           "english_sentence": "When I was a kid, my favorite music group was One Direction."
        },
        {
           "id": 724,
           "turkish_word": "mesela",
           "english_word": "for example",
           "type": "adv",
           "turkish_sentence": "Turunçgillerin hepsi turuncu değildir, mesela greyfurt ve limon.",
           "english_sentence": "Not all the citrus fruits are orange, for example grapefruit and lemon."
        },
        {
           "id": 725,
           "turkish_word": "yerinde",
           "english_word": "appropriate",
           "type": "adv",
           "turkish_sentence": "Her şey yerinde gibi gözüktüğü için, müdahale etmeme gerek kalmadı.",
           "english_sentence": "As everything seemed appropriate, I didn't need to intervene."
        },
        {
           "id": 726,
           "turkish_word": "alanda",
           "english_word": "field",
           "type": "adv",
           "turkish_sentence": "Ünlü bilim insanı ve yazar Yaşar Öztürk, özellikle bu alanda bir profesyonel sayılır.",
           "english_sentence": "Famous scientist and writer Yaşar Öztürk is especially seen as professional in this field."
        },
        {
           "id": 727,
           "turkish_word": "teslim",
           "english_word": "submission",
           "type": "n",
           "turkish_sentence": "Projenin son teslim tarihi 20 Nisan olarak açıklandı.",
           "english_sentence": "The latest submission date of this project is announced as the 20th of April."
        },
        {
           "id": 728,
           "turkish_word": "ceza",
           "english_word": "punishment",
           "type": "n",
           "turkish_sentence": "Yapılan her suçun kanun tarafından belirlenen bir ceza sı vardır.",
           "english_sentence": "Every crime that is committed has a punishment determined by the law."
        },
        {
           "id": 729,
           "turkish_word": "yönetimi",
           "english_word": "management of",
           "type": "n",
           "turkish_sentence": "Sınıf Yönetimi dersi bütün öğretmen adayları için gerekli bir derstir.",
           "english_sentence": "Classroom Management course is necessary for all teacher candidates."
        },
        {
           "id": 730,
           "turkish_word": "sonrasında",
           "english_word": "after",
           "type": "adv",
           "turkish_sentence": "Okul sonrasında arkadaşlarımla birlikte sinemaya gideceğim.",
           "english_sentence": "I will go to the cinema with my friends after school."
        },
        {
           "id": 731,
           "turkish_word": "olduğuna",
           "english_word": "now that",
           "type": "ptcp",
           "turkish_sentence": "Sen de burada olduğuna göre artık bu konuyu konuşabilirz.",
           "english_sentence": "Now that you're also here I think we can talk about this topic."
        },
        {
           "id": 732,
           "turkish_word": "yavaş",
           "english_word": "slow",
           "type": "adj",
           "turkish_sentence": "Bu bilgisayarı alalı daha bir yıl bile olmadı ama şimdiden çok yavaş !",
           "english_sentence": "It hasn't even been a year since I bought this computer but it's already so slow !"
        },
        {
           "id": 733,
           "turkish_word": "uygulama",
           "english_word": "application",
           "type": "n",
           "turkish_sentence": "Yeni geliştirdiğimiz bu Android uygulaması ile istediğiniz her an müzik dinleyebileceksiniz.",
           "english_sentence": "With this Android application we recently developed, you can listen to music whenever you want."
        },
        {
           "id": 734,
           "turkish_word": "seni",
           "english_word": "you",
           "type": "pron",
           "turkish_sentence": "Seni seviyorum ama son zamanlarda bana karşı davranışların hoşuma gitmiyor.",
           "english_sentence": "I love you, but I don't like your attitudes towards me nowadays."
        },
        {
           "id": 735,
           "turkish_word": "yol",
           "english_word": "road",
           "type": "n",
           "turkish_sentence": "Bu yol a ne deniyor biliyor musun?",
           "english_sentence": "Do you know what this road is called?"
        },
        {
           "id": 736,
           "turkish_word": "iletişim",
           "english_word": "contact",
           "type": "n",
           "turkish_sentence": "İletişim bilgilerimi mail yoluyla bu akşam size ileteceğim.",
           "english_sentence": "I will send you my contact information tonight by mail."
        },
        {
           "id": 737,
           "turkish_word": "bende",
           "english_word": "in me",
           "type": "n",
           "turkish_sentence": "Bende bu kadar hoşlanmadığın ne var bilmek istiyorum.",
           "english_sentence": "I want to know what is in me that you don't like this much."
        },
        {
           "id": 738,
           "turkish_word": "üçüncü",
           "english_word": "third",
           "type": "adj",
           "turkish_sentence": "Aynı hatayı üçüncü kez tekrarlarsan seninle bir daha konuşmayacağım.",
           "english_sentence": "If you repeat the same mistake for the third time, I'm not going to talk to you again."
        },
        {
           "id": 739,
           "turkish_word": "alarak",
           "english_word": "by taking",
           "type": "ptcp",
           "turkish_sentence": "Bu yatırım işine bütün riskleri göze alarak başladım.",
           "english_sentence": "I started this investment job by taking all the risks."
        },
        {
           "id": 740,
           "turkish_word": "baş",
           "english_word": "head",
           "type": "n",
           "turkish_sentence": "Yoğun iş temposu nedeniyle, baş ımı kaşımaya vaktim yok.",
           "english_sentence": "Due to the intense work pressure, I don’t even have time to stretch my head\r."
        },
        {
           "id": 741,
           "turkish_word": "açıklamada",
           "english_word": "explanation",
           "type": "n",
           "turkish_sentence": "Okul müdüründen gelen açıklamada kılık ve kıyafete karşı büyük bir disiplin göze çarpıyordu.",
           "english_sentence": "According to the explanation by the school principal, the strict rules for clothing were on point."
        },
        {
           "id": 742,
           "turkish_word": "aralık",
           "english_word": "December",
           "type": "n",
           "turkish_sentence": "Aralık ayında birçok mağazada yılbaşı indirimleri mevcuttur.",
           "english_sentence": "There are lots of Christmas discounts in many shops during December."
        },
        {
           "id": 743,
           "turkish_word": "dolu",
           "english_word": "full",
           "type": "adj",
           "turkish_sentence": "Tren garı sevdiklerini karşılamak için bekleyenlerle dolu.",
           "english_sentence": "The train station is full of people waiting for the people they love."
        },
        {
           "id": 744,
           "turkish_word": "üye",
           "english_word": "member",
           "type": "n",
           "turkish_sentence": "Öğrenciyken birçok okul kulübüne üye idim.",
           "english_sentence": "When I was a student, I was a member of many school clubs."
        },
        {
           "id": 745,
           "turkish_word": "tarım",
           "english_word": "agriculture",
           "type": "n",
           "turkish_sentence": "Tarım ve Hayvancılık Bakanlığı fındık fiyatlarını arttırdı.",
           "english_sentence": "The Ministry of Agriculture and Stockbreeding increased the prices for hazelnut."
        },
        {
           "id": 746,
           "turkish_word": "hepsi",
           "english_word": "all, all of",
           "type": "adv",
           "turkish_sentence": "Öğrencilerin hepsi okul töreni için sıraya girdi.",
           "english_sentence": "All of the students came into line for the school ceremony."
        },
        {
           "id": 747,
           "turkish_word": "yılda",
           "english_word": "in a year",
           "type": "adv",
           "turkish_sentence": "Yılda en az 3 kez ailemle birlikte Uludağ'a kayak yapmaya giderim.",
           "english_sentence": "I go skiing with my parents in Uludağ at least 3 times a year."
        },
        {
           "id": 748,
           "turkish_word": "bulundu",
           "english_word": "was/were found",
           "type": "v",
           "turkish_sentence": "Arkadaşımın evinde kaybettiğim eldivenlerim 3 gün sonra tekrar gittiğimde bulundu.",
           "english_sentence": "The gloves I lost in my friend's house were found 3 days after I went again."
        },
        {
           "id": 749,
           "turkish_word": "hayır",
           "english_word": "no",
           "type": "n",
           "turkish_sentence": "İnsanların seni kullanmasını istemiyorsan “hayır ” demeyi öğrenmelisin.",
           "english_sentence": "If you don't want others to use you, you should learn how to say \"no\"."
        },
        {
           "id": 750,
           "turkish_word": "görmek",
           "english_word": "see",
           "type": "v",
           "turkish_sentence": "Bunca yolu sırf beni görmek için mi geldin gerçekten?",
           "english_sentence": "Did you really come all the way here only to see me?"
        },
        {
           "id": 751,
           "turkish_word": "oysa",
           "english_word": "though",
           "type": "conj",
           "turkish_sentence": "Oysa ben her şey yolunda sanıyordum, meğer ne çok problem varmış.",
           "english_sentence": "There were so many problems, though I thought everything was all right."
        },
        {
           "id": 752,
           "turkish_word": "çalışmalar",
           "english_word": "works",
           "type": "n",
           "turkish_sentence": "Sabahattin Ali edebiyat alanındaki çalışmalar ıyla ünlü bir yazardır.",
           "english_sentence": "Sabahattin Ali is a famous writer known for his works in the literature field."
        },
        {
           "id": 753,
           "turkish_word": "acaba",
           "english_word": "I wonder if",
           "type": "interj",
           "turkish_sentence": "Randevum olmamasına rağmen kuafore girmeme izin verirler mi acaba?",
           "english_sentence": "I wonder if they would let me in even though I don't have an appointment."
        },
        {
           "id": 754,
           "turkish_word": "hayata",
           "english_word": "to life",
           "type": "adv",
           "turkish_sentence": "Mustafa Kemal Atatürk 10 Kasım 1938 yılında hayata gözlerini yumdu.",
           "english_sentence": "Mustafa Kemal Atatürk passed away from this life on 10 November 1938."
        },
        {
           "id": 755,
           "turkish_word": "partisi",
           "english_word": "party",
           "type": "n",
           "turkish_sentence": "İlkokul arkadaşım Sude bu akşam için beni doğum günü partisi ne çağırdı.",
           "english_sentence": "Sude, my friend from elementary school, invited me to the birthday party for tomorrow.",
           "notes": "of/for"
        },
        {
           "id": 756,
           "turkish_word": "yardımcı",
           "english_word": "assistant",
           "type": "n",
           "turkish_sentence": "Okula kayıt yaptırmak için müdür yardımcı sıyla görüşmelisiniz.",
           "english_sentence": "You can talk to the assistant manager to enter this school."
        },
        {
           "id": 757,
           "turkish_word": "kesinlikle",
           "english_word": "absolutely",
           "type": "adv",
           "turkish_sentence": "Olayların tahmin ettiğim gibi gittiğine kesinlikle eminim.",
           "english_sentence": "I am absolutely sure that the things happened as I guessed."
        },
        {
           "id": 758,
           "turkish_word": "neler",
           "english_word": "what",
           "type": "pron pl",
           "turkish_sentence": "Dünkü üniversite gezisine gelmeyerek neler kaçırdın bir bilsen.",
           "english_sentence": "You don't know what you missed by not coming to the university trip yesterday."
        },
        {
           "id": 759,
           "turkish_word": "etmiş",
           "english_word": "did",
           "type": "v",
           "turkish_sentence": "O çocuğun sözlerine inanmayarak çok iyi etmiş !",
           "english_sentence": "She did well by not believing that child's words!"
        },
        {
           "id": 760,
           "turkish_word": "çocuklar",
           "english_word": "children",
           "type": "n",
           "turkish_sentence": "Bu akşam çocuklar için hazırlanmış çok güzel bir etkinlik var.",
           "english_sentence": "Tonight there is a very good event prepared for children."
        },
        {
           "id": 761,
           "turkish_word": "birisi",
           "english_word": "someone",
           "type": "pron",
           "turkish_sentence": "Birisi bana burada ne olduğunu açıklayabilir mi artık?",
           "english_sentence": "Can someone explain to me what's going on here please?"
        },
        {
           "id": 762,
           "turkish_word": "yapıyor",
           "english_word": "be doing",
           "type": "v",
           "turkish_sentence": "Bu saatte sokakta ne yapıyor çok merak ediyorum doğrusu.",
           "english_sentence": "I really wonder what he's doing in the streets at this hour."
        },
        {
           "id": 763,
           "turkish_word": "edip",
           "english_word": "by doing",
           "type": "ptcp",
           "turkish_sentence": "Bu sınavı ne yapıp edip geçmem gerektiğini biliyorum.",
           "english_sentence": "I know that I need to pass this exam by doing whatever I can."
        },
        {
           "id": 764,
           "turkish_word": "yaz",
           "english_word": "summer",
           "type": "n",
           "turkish_sentence": "Çok geçmeden yaz tatili için bir yer arayışına başlamamız lazım, yoksa her yer dolu olacak.",
           "english_sentence": "We need to start looking for a place for the summer holiday or else everywhere will be full."
        },
        {
           "id": 765,
           "turkish_word": "bilgiler",
           "english_word": "information",
           "type": "n pl",
           "turkish_sentence": "Farklı türlerden kitap okuyarak yeni bilgiler öğrenme şansımız var.",
           "english_sentence": "We have a chance to get new information by reading books with different genres."
        },
        {
           "id": 766,
           "turkish_word": "alıp",
           "english_word": "taking",
           "type": "adv",
           "turkish_sentence": "Kardeşimi okuldan alıp hemen yanınıza geleceğim.",
           "english_sentence": "I will come to your place right after taking my sister from school."
        },
        {
           "id": 767,
           "turkish_word": "Fenerbahçe",
           "english_word": "Fenerbahçe",
           "type": "n",
           "turkish_sentence": "Eda fanatik olduğu için, havanın soğuk olmasına rağmen Fenerbahçe maçına gideceğini söyledi.",
           "english_sentence": "As Eda was a fanatic, she said she would go to the Fenerbahçe match, even though the weather was cold.",
           "notes": "a football team in Turkey"
        },
        {
           "id": 768,
           "turkish_word": "neden",
           "english_word": "reason",
           "type": "n",
           "turkish_sentence": "Bu kadar geç kalmanın umarım mantıklı bir neden i vardır, yoksa başın belaya girecek.",
           "english_sentence": "I hope you have a logical reason to be late or else you will get into trouble."
        },
        {
           "id": 769,
           "turkish_word": "gösteren",
           "english_word": "showing",
           "type": "ptcp",
           "turkish_sentence": "Çıkış yönünü gösteren tabelaları takip ederek alışveriş merkezinden çıktık.",
           "english_sentence": "We left the shopping mall by following the signs showing the way to exit."
        },
        {
           "id": 770,
           "turkish_word": ".com",
           "english_word": ". com",
           "type": "n",
           "turkish_sentence": "Gerekli bilgileri www.lingomastery.com adresinden bulabilirsin.",
           "english_sentence": "You can find the necessary information on www.lingomastery.com. "
        },
        {
           "id": 771,
           "turkish_word": "Türkçe",
           "english_word": "Turkish",
           "type": "n",
           "turkish_sentence": "Türkçe dünyadaki en zor dillerden birisi olarak kabul edilir.",
           "english_sentence": "Turkish is regarded as one of the hardest languages in the world."
        },
        {
           "id": 772,
           "turkish_word": "etmek",
           "english_word": "to do",
           "type": "adv",
           "turkish_sentence": "Bu çocukça davranışlarınla ne etme ye çalışıyorsun anlayamıyorum.",
           "english_sentence": "I can't understand what you're trying to do by acting childishly."
        },
        {
           "id": 773,
           "turkish_word": "modern",
           "english_word": "modern",
           "type": "adj",
           "turkish_sentence": "Modern edebiyat, klasik edebiyata tepki olarak doğmuştur.",
           "english_sentence": "Modern literature was born as a reaction to the classical literature."
        },
        {
           "id": 774,
           "turkish_word": "kimi",
           "english_word": "who",
           "type": "pron",
           "turkish_sentence": "Bu okuldaki öğretmenlerin arasından en çok kimi seviyorsun?",
           "english_sentence": "Who do you love the most among your teachers in this school?"
        },
        {
           "id": 775,
           "turkish_word": "sıcak",
           "english_word": "hot",
           "type": "adv",
           "turkish_sentence": "Kahvenin sıcak olduğunu unutup içmeye çalıştı ama dili yandı.",
           "english_sentence": "He forgot that the coffee was hot and tried to drink, but he burned his tongue."
        },
        {
           "id": 776,
           "turkish_word": "hukuk",
           "english_word": "law",
           "type": "n",
           "turkish_sentence": "Sekiz yıldır hukuk fakültesindeyim ancak daha okulu bitiremedim.",
           "english_sentence": "I have been in the law faculty for eight years but still I couldn't finish school."
        },
        {
           "id": 777,
           "turkish_word": "araç",
           "english_word": "vehicle",
           "type": "n",
           "turkish_sentence": "Bu alana araç park edilmesi yasaktır, aksi takdirde para cezası uygulanacaktır.",
           "english_sentence": "It is forbidden to park a vehicle in this area, otherwise a cash fine will be applied."
        },
        {
           "id": 778,
           "turkish_word": "kesin",
           "english_word": "certain",
           "type": "adj",
           "turkish_sentence": "Türkiye'ye kesin dönüş tarihin belli mi?",
           "english_sentence": "Is there a certain date for your return to Turkey?"
        },
        {
           "id": 779,
           "turkish_word": "değişik",
           "english_word": "interesting",
           "type": "adj",
           "turkish_sentence": "Kendi doğum günü partisi için seçtiği kıyafet epey değişik ti doğrusu.",
           "english_sentence": "Her costume for her own birthday party was very interesting indeed."
        },
        {
           "id": 780,
           "turkish_word": "program",
           "english_word": "program",
           "type": "n",
           "turkish_sentence": "Festival program ına baktık ama bu gece için herhangi bir etkinlik yoktu.",
           "english_sentence": "We checked the festival program but there was no event for tonight."
        },
        {
           "id": 781,
           "turkish_word": "bölüm",
           "english_word": "chapter/episode",
           "type": "n",
           "turkish_sentence": "Kitabın son bölüm ünde neler olacağını çok merak ediyorum.",
           "english_sentence": "I am so curious about what’s going to happen in the last chapter of the book."
        },
        {
           "id": 782,
           "turkish_word": "ondan",
           "english_word": "from him/her/it",
           "type": "adv",
           "turkish_sentence": "Ondan bir şey bekleyeceğime, kendi işimi kendim yapmayı tercih ederim.",
           "english_sentence": "I would prefer doing my own business instead of waiting for something from him."
        },
        {
           "id": 783,
           "turkish_word": "temmuz",
           "english_word": "July",
           "type": "n",
           "turkish_sentence": "Temmuz ayında İstanbul'da çok önemli bir sanat festivali olacak.",
           "english_sentence": "There will be a very important art festival in Istanbul in July."
        },
        {
           "id": 784,
           "turkish_word": "satın almak",
           "english_word": "to buy",
           "type": "v",
           "turkish_sentence": "İnternet üzerinden satın al dığım elbise elime ulaştığında hayal kırıklığı yaşadım, çünkü beğendiğim elbiseyle alakası yoktu.",
           "english_sentence": "When I got the dress I bought online, I was disappointed because it had nothing to do with the one I liked."
        },
        {
           "id": 785,
           "turkish_word": "alıyor",
           "english_word": "getting",
           "type": "v",
           "turkish_sentence": "Pencereleri bilerek açtım, kapatma lütfen; oda temiz hava alıyor.",
           "english_sentence": "I opened the windows on purpose; please don't shut them, the room is getting fresh air."
        },
        {
           "id": 786,
           "turkish_word": "yatırım",
           "english_word": "investment",
           "type": "n",
           "turkish_sentence": "Şimdiden para biriktirmeye başlayarak ve başka işlerde de çalışarak geleceğe yatırım yapıyor.",
           "english_sentence": "She is making investments for her future by saving money and working at other jobs."
        },
        {
           "id": 787,
           "turkish_word": "vergi",
           "english_word": "tax",
           "type": "n",
           "turkish_sentence": "Her vatandaş aylık kazancına göre devlete vergi öder.",
           "english_sentence": "Every citizen pays their taxes to the state according to their monthly salary."
        },
        {
           "id": 788,
           "turkish_word": "geçtiğimiz",
           "english_word": "last/that we past",
           "type": "ptcp",
           "turkish_sentence": "Geçtiğimiz yıl trafik kazalarının sayısı şimdiki yıla göre %5 daha azdı.",
           "english_sentence": "Last year, the number of the traffic accidents were 5% less than this year."
        },
        {
           "id": 789,
           "turkish_word": "öğretim",
           "english_word": "education",
           "type": "n",
           "turkish_sentence": "2019-2020 eğitim öğretim yılında tüm öğrencilere başarılar dilerim.",
           "english_sentence": "I wish all students success for the 2019-2020 education year."
        },
        {
           "id": 790,
           "turkish_word": "yapmış",
           "english_word": "made",
           "type": "v",
           "turkish_sentence": "Annem doğum günüm için kocaman bir yaş pasta yapmış.",
           "english_sentence": "My mom made a huge cake for my birthday."
        },
        {
           "id": 791,
           "turkish_word": "insanlar",
           "english_word": "people",
           "type": "n",
           "turkish_sentence": "İnsanlar ı yargılamadan önce onlarla empati yapmayı denemelisiniz.",
           "english_sentence": "You need to try empathizing with people before judging them."
        },
        {
           "id": 792,
           "turkish_word": "yaş",
           "english_word": "years",
           "type": "n",
           "turkish_sentence": "65 yaş üstü vatandaşlar belediye otobüslerini ücretsiz olarak kullanabilirler.",
           "english_sentence": "Citizens of 65 years or more can use the public bus for free."
        },
        {
           "id": 793,
           "turkish_word": "ders",
           "english_word": "lesson",
           "type": "n",
           "turkish_sentence": "Üniversitedeyken birçok kişiye İngilizce özel ders verdiğim için bu alanda tecrübeliyim.",
           "english_sentence": "As I gave private English lessons to so many people when I was in the university, I am quite experienced in this field."
        },
        {
           "id": 794,
           "turkish_word": "güneş",
           "english_word": "sun",
           "type": "n",
           "turkish_sentence": "Kış aylarında güneş görmeyi özlüyorum gerçekten.",
           "english_sentence": "I really miss seeing the sun during winter months."
        },
        {
           "id": 795,
           "turkish_word": "talep",
           "english_word": "demand",
           "type": "n",
           "turkish_sentence": "Şirketin aynı ürünü yeniden üretime sokması için yoğun bir talep var.",
           "english_sentence": "There is a big demand for the company to produce the same product again."
        },
        {
           "id": 796,
           "turkish_word": "Antalya",
           "english_word": "Antalya",
           "type": "n",
           "turkish_sentence": "Antalya yaz aylarında birçok turisti ağırladığı için çok kalabalıktır.",
           "english_sentence": "Antalya is very crowded during summer because of hosting so many tourists.",
           "notes": "a city in Turkey"
        },
        {
           "id": 797,
           "turkish_word": "sonucunda",
           "english_word": "as a result of",
           "type": "postp",
           "turkish_sentence": "Bu olumsuz davranışlarının sonucunda alacağın cezayı biliyorsun değil mi?",
           "english_sentence": "You know what punishment you will get as a result o f your negative behaviors, right?"
        },
        {
           "id": 798,
           "turkish_word": "dışı",
           "english_word": "outside",
           "type": "postp",
           "turkish_sentence": "Çocuğum için okul dışı eğitim olarak ne yapabilirim sizce?",
           "english_sentence": "What do you think I can do for teaching my child outside school?"
        },
        {
           "id": 799,
           "turkish_word": "boş",
           "english_word": "blank",
           "type": "adj",
           "turkish_sentence": "Sınava hiç çalışmadığım ve derslere hiç gitmediğim için hocaya boş kâğıt verdim.",
           "english_sentence": "I gave the teacher a blank paper because I didn't study at all and never went to the classes."
        },
        {
           "id": 800,
           "turkish_word": "yorum",
           "english_word": "comment",
           "type": "n",
           "turkish_sentence": "Videomun altına hep olumlu yorum geldiği için çok mutluyum.",
           "english_sentence": "I am so happy that I got only positive comments under my video."
        },
        {
           "id": 801,
           "turkish_word": "yapıldı",
           "english_word": "took place on",
           "type": "verb",
           "turkish_sentence": "2018 Milletvekili Genel Seçimleri 24 Haziran 2018’de yapıldı.",
           "english_sentence": "2018 Parliamentary General Elections took place on 24 June 2018."
        },
        {
           "id": 802,
           "turkish_word": "is",
           "english_word": "soot",
           "type": "n",
           "turkish_sentence": "Oturma odasının duvarları is le kaplanmıştı.",
           "english_sentence": "The walls of the living room were covered with soot. "
        },
        {
           "id": 803,
           "turkish_word": "serbest",
           "english_word": "free",
           "type": "adj",
           "turkish_sentence": "Öğretmen öğrencilerine “Bu etkinliği yaptıktan sonra serbest siniz,” dedi.",
           "english_sentence": "The teacher said, “You are free after you finish this exercise,” to her students. "
        },
        {
           "id": 804,
           "turkish_word": "üniversite",
           "english_word": "university",
           "type": "n",
           "turkish_sentence": "Üniversite ye başladıktan sonra hayatımda çok şey değişti.",
           "english_sentence": "After I started my university, so many things changed in my life. "
        },
        {
           "id": 805,
           "turkish_word": "satış",
           "english_word": "sales",
           "type": "n",
           "turkish_sentence": "Ekonomik krizden sonra birçok şirket satış politikasını değiştirmek zorunda kaldı.",
           "english_sentence": "After the financial crisis, lots of companies had to change their sales policy. "
        },
        {
           "id": 806,
           "turkish_word": "basit",
           "english_word": "simple",
           "type": "adj",
           "turkish_sentence": "Dünkü sınav bu kadar basit olmasaydı yüksek puan alamazdım.",
           "english_sentence": "If the exam from yesterday hadn’t been so simple, I couldn’t have gotten a good score."
        },
        {
           "id": 807,
           "turkish_word": "giden",
           "english_word": "sent",
           "type": "ptcp",
           "turkish_sentence": "Daha önceden gönderdiğiniz postaları “giden posta” kutusunda bulabilirsiniz.",
           "english_sentence": "You can find the mails you’ve sent so far in the “sent mail” box. "
        },
        {
           "id": 808,
           "turkish_word": "barış",
           "english_word": "peace",
           "type": "n",
           "turkish_sentence": "Devletin en önemli görevi, vatandaşlarının barış içinde yaşamasını sağlamaktır.",
           "english_sentence": "The most important duty of government is to ensure its citizens live in peace. "
        },
        {
           "id": 809,
           "turkish_word": "altı",
           "english_word": "under",
           "type": "postp",
           "turkish_sentence": "18 yaş altı kişilerin araç kullanması ve alkol satın alması yasaktır.",
           "english_sentence": "People under 18 are prohibited from driving and purchasing alcohol."
        },
        {
           "id": 810,
           "turkish_word": "yaparak",
           "english_word": "by doing",
           "type": "ptcp",
           "turkish_sentence": "Böyle çocukça davranışlar yaparak ne elde edebilirsin bilmiyorum.",
           "english_sentence": "I don’t know what you can achieve by doing these kinds of childish things.",
           "notes": "something"
        },
        {
           "id": 811,
           "turkish_word": "sona",
           "english_word": "to the end",
           "type": "adv",
           "turkish_sentence": "Okul sona yaklaştıkça, ödevler ve sınavlar arttığı için çok meşgul oluyorum.",
           "english_sentence": "As school comes to the end, I become so busy because of the homework and exams. "
        },
        {
           "id": 812,
           "turkish_word": "İngiltere",
           "english_word": "England",
           "type": "n",
           "turkish_sentence": "İngiltere ’den birçok ünlü yazar, sanatçı ve düşünür çıkmıştır.",
           "english_sentence": "There are so many famous writers, artists, and philosophers from England."
        },
        {
           "id": 813,
           "turkish_word": "-dan",
           "english_word": "from",
           "type": "ablative case suffix",
           "turkish_sentence": "Dün geceki olayı bir de başkasının bakış açısından değerlendirmeliyiz.",
           "english_sentence": "We should evaluate the incident from last night from someone else’s point of view."
        },
        {
           "id": 814,
           "turkish_word": "ederim",
           "english_word": "I do/would do",
           "type": "v",
           "turkish_sentence": "Ailem yanımda olmazsa tek başıma ne ederim, bilmiyorum.",
           "english_sentence": "I don’t know what I would do alone if I didn't have my family with me."
        },
        {
           "id": 815,
           "turkish_word": "parlak",
           "english_word": "bright",
           "type": "adj",
           "turkish_sentence": "Yıldızlar bu gece parlak.",
           "english_sentence": "Stars are bright tonight."
        },
        {
           "id": 816,
           "turkish_word": "bugüne",
           "english_word": "for today",
           "type": "adv",
           "turkish_sentence": "Fransa’dan aldığım şarabı bugüne saklamıştım.",
           "english_sentence": "I’d reserved the wine I bought from France for today."
        },
        {
           "id": 817,
           "turkish_word": "geçti",
           "english_word": "passed",
           "type": "v",
           "turkish_sentence": "Zor günler geçti, artık geleceğe odaklanmalısın.",
           "english_sentence": "Hard days have passed, now you need to focus on the future."
        },
        {
           "id": 818,
           "turkish_word": "olumsuz",
           "english_word": "negative",
           "type": "adj",
           "turkish_sentence": "Arkadaşının kardeşim üzerinde olumsuz etkisi olduğunu düşünüyorum.",
           "english_sentence": "I think my sister’s friend has a negative effect on her. "
        },
        {
           "id": 819,
           "turkish_word": "şubat",
           "english_word": "February",
           "type": "n",
           "turkish_sentence": "Şubat diğer ayların arasında en kısa süren aydır.",
           "english_sentence": "February is the shortest month among the other months."
        },
        {
           "id": 820,
           "turkish_word": "-le",
           "english_word": "with",
           "type": "postp",
           "turkish_sentence": "Her akşam ailemle birlikte yemek yer sohbet ederim.",
           "english_sentence": "Every evening I eat and chat with my family.",
           "notes": "synonym of “ile” which means “with”"
        },
        {
           "id": 821,
           "turkish_word": "sol",
           "english_word": "left",
           "type": "adj",
           "turkish_sentence": "Küçüklüğümde kendimi alıştırdığım için, şu an sol elle yazı yazabiliyorum.",
           "english_sentence": "Now I can write with my left hand as I practiced it when I was young. "
        },
        {
           "id": 822,
           "turkish_word": "alanında",
           "english_word": "in the field of",
           "type": "adv",
           "turkish_sentence": "Burun estetiği alanında, Murat Bey bu hastanedeki en iyi cerrahtır.",
           "english_sentence": "Mr. Murat is the best surgeon in this hospital in the field of rhinoplasty."
        },
        {
           "id": 823,
           "turkish_word": "sanırım",
           "english_word": "I guess",
           "type": "adv",
           "turkish_sentence": "Sanırım arkadaşımın bir problemi var çünkü dün gördüğümde morali bozuktu.",
           "english_sentence": "I guess my friend has a problem because when I saw her yesterday, she seemed upset."
        },
        {
           "id": 824,
           "turkish_word": "yazar",
           "english_word": "writer",
           "type": "n",
           "turkish_sentence": "Yarınki kitap fuarına birçok ünlü yazar konuk oluyor.",
           "english_sentence": "Many famous writers will join the book fair tomorrow."
        },
        {
           "id": 825,
           "turkish_word": "program",
           "english_word": "program",
           "type": "n",
           "turkish_sentence": "Koçumdan sıkı bir egzersiz program ı yazmasını istedim.",
           "english_sentence": "I asked for a strict exercise program from my coach."
        },
        {
           "id": 826,
           "turkish_word": "kendilerini",
           "english_word": "themselves",
           "type": "adv",
           "turkish_sentence": "Bu üniversitedeki öğrenciler kendilerini daha iyi hissetmek için her zaman çok çalışırlar.",
           "english_sentence": "The students in this university always study hard to make themselves feel better."
        },
        {
           "id": 827,
           "turkish_word": "bilgisayar",
           "english_word": "computer",
           "type": "n",
           "turkish_sentence": "Doğum günümde babamdan hediye olarak bilgisayar aldım.",
           "english_sentence": "I received a computer from my father for my birthday."
        },
        {
           "id": 828,
           "turkish_word": "yapı",
           "english_word": "structure",
           "type": "n",
           "turkish_sentence": "Bu binanın yapı sı çok sağlam olmadığı için deprem anında kolayca yıkılabilir.",
           "english_sentence": "This building can be collapsed easily during an earthquake because its structure isn’t so solid."
        },
        {
           "id": 829,
           "turkish_word": "Galatasaray",
           "english_word": "Galatasaray",
           "type": "n",
           "turkish_sentence": "Galatasaray, Şampiyon Kulüpler Kupası'na katılan ilk Türk takımıdır.",
           "english_sentence": "Galatasaray is the first Turkish football team that has joined the Champions League Cup.",
           "notes": "a football team in Turkey"
        },
        {
           "id": 830,
           "turkish_word": "ek",
           "english_word": "addition",
           "type": "n",
           "turkish_sentence": "Amcam düzenli maaşına ek olarak, sahibi olduğu iki daireden kira parası alıyor.",
           "english_sentence": "In addition to his regular salary, my uncle gets the rent money of the two apartments he owns."
        },
        {
           "id": 831,
           "turkish_word": "Fransa",
           "english_word": "France",
           "type": "n",
           "turkish_sentence": "2018 yılında Fransa ’da değişim öğrencisi olarak 1 yıl yaşadım.",
           "english_sentence": "In 2018, I lived in France for one year as an exchange student."
        },
        {
           "id": 832,
           "turkish_word": "erken",
           "english_word": "early",
           "type": "adv",
           "turkish_sentence": "Rutin haline dönüştürüldüğünde sabah erken saatte kalkmak geç kalkmaktan daha sağlıklıdır.",
           "english_sentence": "Waking up early in the morning is healthier than waking up late when it’s turned into a routine."
        },
        {
           "id": 833,
           "turkish_word": "maç",
           "english_word": "match",
           "type": "n",
           "turkish_sentence": "Haftaya Basketbol Dünya Kupası’nın final maç ı Berlin’de oynanacak.",
           "english_sentence": "Next week, the final match of the World Basketball Cup will be held in Berlin."
        },
        {
           "id": 834,
           "turkish_word": "yalnızca",
           "english_word": "only",
           "type": "adv",
           "turkish_sentence": "Kafedeki yarı zamanlı işinden yalnızca 1000 Türk Lirası kazanıyormuş diye duydum.",
           "english_sentence": "I heard he earned only 1,000 Turkish Liras from his part-time job in the café."
        },
        {
           "id": 835,
           "turkish_word": "kredi",
           "english_word": "credits",
           "type": "n",
           "turkish_sentence": "Üniversiteden mezun olmak için en az 30 kredi m olması gerek.",
           "english_sentence": "I need to have at least 30 credits to graduate from my university."
        },
        {
           "id": 836,
           "turkish_word": "arkadaşlar",
           "english_word": "friends",
           "type": "n",
           "turkish_sentence": "Doğum günüm için yakın arkadaşlar arasında küçük bir parti düzenlemek istiyorum.",
           "english_sentence": "I want to hold a small party with my close friends for my birthday."
        },
        {
           "id": 837,
           "turkish_word": "hükümet",
           "english_word": "government",
           "type": "n",
           "turkish_sentence": "Birçok devlet çalışanı hükûmet karşıtı söylemlerde bulunduğu için işini kaybetti.",
           "english_sentence": "Lots of civil servants lost their jobs due to their speeches against the government."
        },
        {
           "id": 838,
           "turkish_word": "sezon",
           "english_word": "season",
           "type": "n",
           "turkish_sentence": "Meyve ve sebzeleri sezon unda yemek en sağlıklı yöntemdir.",
           "english_sentence": "Eating fruits and vegetables in their season is the healthiest way."
        },
        {
           "id": 839,
           "turkish_word": "altın",
           "english_word": "golden",
           "type": "adj",
           "turkish_sentence": "Erkek arkadaşım yıl dönümümüzde bana altın kolye aldı.",
           "english_sentence": "My boyfriend bought me a golden necklace for our anniversary."
        },
        {
           "id": 840,
           "turkish_word": "ortadan",
           "english_word": "from/through/in the middle",
           "type": "adv",
           "turkish_sentence": "Salata için domatesleri ortadan ikiye keser misin?",
           "english_sentence": "Can you cut the tomatoes in the middle for the salad?"
        },
        {
           "id": 841,
           "turkish_word": "kazanç",
           "english_word": "profit",
           "type": "n",
           "turkish_sentence": "Satışlar böyle durgun olmaya devam ederse, yeteri kadar kazanç elde edemezsin.",
           "english_sentence": "You can’t earn the profits if the sales keep being slow."
        },
        {
           "id": 842,
           "turkish_word": "alanı",
           "english_word": "field of something/someone",
           "type": "n",
           "turkish_sentence": "Psikoloji ilgi alanı m olduğu için insanlarla sohbet etmeyi seviyorum.",
           "english_sentence": "I like to talk with people because psychology is my field of interest."
        },
        {
           "id": 843,
           "turkish_word": "veriyor",
           "english_word": "",
           "type": "v",
           "turkish_sentence": "En yakın arkadaşım üniversitede edebiyat dersi veriyor.",
           "english_sentence": "My best friend is giving a literature class in university.",
           "notes": "is"
        },
        {
           "id": 844,
           "turkish_word": "merak",
           "english_word": "curiosity",
           "type": "n",
           "turkish_sentence": "Merak, öğrenmek için en etkili etkendir.",
           "english_sentence": "Curiosity is the most efficient factor for learning."
        },
        {
           "id": 845,
           "turkish_word": "yapmaya",
           "english_word": "to do",
           "type": "ptcp",
           "turkish_sentence": "Bazen ne yapmaya çalıştığını anlayamıyorum.",
           "english_sentence": "Sometimes, I can’t understand what you’re trying to do."
        },
        {
           "id": 846,
           "turkish_word": "canlı",
           "english_word": "alive",
           "type": "adv",
           "turkish_sentence": "Dün gece binada çıkan yangından herkes canlı olarak kurtulabildi.",
           "english_sentence": "Everyone could stay alive despite the fire in the building."
        },
        {
           "id": 847,
           "turkish_word": "geçmiş",
           "english_word": "past",
           "type": "n",
           "turkish_sentence": "Sürekli geçmiş i düşünmekle hiçbir şey elde edemezsin.",
           "english_sentence": "You can’t make anything by thinking about the past all the time."
        },
        {
           "id": 848,
           "turkish_word": "bulunuyor",
           "english_word": "be",
           "type": "v",
           "turkish_sentence": "Belediye binasının önünde bir heykel bulunuyor.",
           "english_sentence": "There is a monument in front of the city hall.",
           "notes": "am, is, are"
        },
        {
           "id": 849,
           "turkish_word": "sebep",
           "english_word": "reason",
           "type": "n",
           "turkish_sentence": "Son günlerde yaptığı garip davranışların sebeb ini öğrenmek istiyorum.",
           "english_sentence": "I want to know the reason of the strange behaviors he does lately."
        },
        {
           "id": 850,
           "turkish_word": "hakları",
           "english_word": "",
           "type": "n",
           "turkish_sentence": "Çocuk hakları savunucusu birçok politikacıya ihtiyacımız var.",
           "english_sentence": "We need many politicians who support children’s rights. ",
           "notes": "his/her/its/their"
        },
        {
           "id": 851,
           "turkish_word": "edilir",
           "english_word": "be made",
           "type": "v",
           "turkish_sentence": "Her yıl sonu, iyi yeni yıl duaları edilir.",
           "english_sentence": "Every end of the year, happy new year wishes are made. "
        },
        {
           "id": 852,
           "turkish_word": "etme",
           "english_word": "making",
           "type": "n",
           "turkish_sentence": "O kişi beni sana düşman etme amacıyla benimle arkadaş oldu.",
           "english_sentence": "That person became my friend for the purpose of making me and you enemies."
        },
        {
           "id": 853,
           "turkish_word": "bulunmaktadır",
           "english_word": "be",
           "type": "v",
           "turkish_sentence": "Dikkat! Bu yolda tadilat bulunmaktadır.",
           "english_sentence": "Attention! There are repairs in this road.",
           "notes": "am/is/are"
        },
        {
           "id": 854,
           "turkish_word": "aşırı",
           "english_word": "over",
           "type": "adv",
           "turkish_sentence": "Aşırı spor yapmak kaslara ciddi hasar verebilir.",
           "english_sentence": "Over -exercising may cause serious harm on the muscles."
        },
        {
           "id": 855,
           "turkish_word": "gören",
           "english_word": "seeing",
           "type": "ptcp",
           "turkish_sentence": "Pencereden içeriyi gören biri var mı, kontrol eder misin?",
           "english_sentence": "Can you check if there is anybody seeing from inside the window?"
        },
        {
           "id": 856,
           "turkish_word": "öncesi",
           "english_word": "before",
           "type": "postp",
           "turkish_sentence": "Cumhuriyet öncesi eğitim devlete ait değildi.",
           "english_sentence": "Education didn’t belong to the state before the Republic."
        },
        {
           "id": 857,
           "turkish_word": "içi",
           "english_word": "inside",
           "type": "postp",
           "turkish_sentence": "Ev içi nde rahat kıyafetler giymeyi seviyorum.",
           "english_sentence": "I like to wear comfy clothes inside the house."
        },
        {
           "id": 858,
           "turkish_word": "bakan",
           "english_word": "minister",
           "type": "n",
           "turkish_sentence": "Ekonomi bakan ı önümüzdeki ay devlet memuru maaşına %10 zam geleceğini duyurdu.",
           "english_sentence": "The Minister of Economy announced that the salary of state officials will receive a 10% raise next month."
        },
        {
           "id": 859,
           "turkish_word": "turizm",
           "english_word": "tourism",
           "type": "n",
           "turkish_sentence": "Turizm Ege Bölgesi’nde çok önemli bir ekonomik gelir kaynağıdır.",
           "english_sentence": "Tourism is a very important economic source of income for the Aegean Anatolian Region."
        },
        {
           "id": 860,
           "turkish_word": "getiren",
           "english_word": "bringing",
           "type": "ptcp",
           "turkish_sentence": "Çocuk sahibi olmak, beraberinde ciddi sorumluluk getiren bir tecrübedir.",
           "english_sentence": "Having a child is an experience bringing serious responsibilities."
        },
        {
           "id": 861,
           "turkish_word": "kara",
           "english_word": "black",
           "type": "adj",
           "turkish_sentence": "Tarihte ilk kez uzaydaki bir kara deliğin fotoğrafı çekildi.",
           "english_sentence": "For the first time in history, the picture of a black hole in space has been taken."
        },
        {
           "id": 862,
           "turkish_word": "güney",
           "english_word": "south",
           "type": "n",
           "turkish_sentence": "Güney insanı genelde enerjik ve neşeli olur.",
           "english_sentence": "People in the south are usually energetic and happy."
        },
        {
           "id": 863,
           "turkish_word": "not",
           "english_word": "note",
           "type": "n",
           "turkish_sentence": "Soruları yanıtlamaya başlamadan önce, açıklama not unu lütfen dikkatle okuyunuz.",
           "english_sentence": "Please read the explanatory note carefully before starting to answer the questions."
        },
        {
           "id": 864,
           "turkish_word": "giderek",
           "english_word": "gradually",
           "type": "ptcp",
           "turkish_sentence": "Dedemin hastalığı giderek ağırlaşıyor.",
           "english_sentence": "My grandfather’s illness is gradually getting worse. "
        },
        {
           "id": 865,
           "turkish_word": "sınıf",
           "english_word": "class",
           "type": "n",
           "turkish_sentence": "Ablam sınıf öğretmeni olarak çalışıyor.",
           "english_sentence": "My older sister is working as a class teacher."
        },
        {
           "id": 866,
           "turkish_word": "açıklama",
           "english_word": "explanation",
           "type": "n",
           "turkish_sentence": "Dün akşamki yanlış anlaşılmadan sonra bir açıklama bekliyor.",
           "english_sentence": "She is waiting for an explanation after last night’s misunderstanding."
        },
        {
           "id": 867,
           "turkish_word": "durumunda",
           "english_word": "in case",
           "type": "adv",
           "turkish_sentence": "Aciliyet durumunda lütfen bu numaradan bana ulaşınız.",
           "english_sentence": "Please contact me from this number in case of an emergency. ",
           "notes": "of"
        },
        {
           "id": 868,
           "turkish_word": "işaret",
           "english_word": "sign",
           "type": "n",
           "turkish_sentence": "Okulda işaret dili eğitimi alıyorum.",
           "english_sentence": "I am taking a sign language education course in the school."
        },
        {
           "id": 869,
           "turkish_word": "tv",
           "english_word": "television",
           "type": "n",
           "turkish_sentence": "Gündelik hayatımda tv programı izlemem.",
           "english_sentence": "I don’t watch television programs in my daily life."
        },
        {
           "id": 870,
           "turkish_word": "okul",
           "english_word": "school",
           "type": "n",
           "turkish_sentence": "5 yıl önce okul u bitirdim ancak halen işsizim.",
           "english_sentence": "I finished school 5 years ago but I’m still unemployed."
        },
        {
           "id": 871,
           "turkish_word": "projesi",
           "english_word": "project of",
           "type": "n poss",
           "turkish_sentence": "TÜBİTAK Projesi kapsamında okuldan üç öğrenci katılımcı olarak seçildi.",
           "english_sentence": "Three students from the school have been chosen as participants for the TÜBİTAK Project. "
        },
        {
           "id": 872,
           "turkish_word": "imza",
           "english_word": "signature",
           "type": "n",
           "turkish_sentence": "Bu kredi kartına sahip olmak için babamın imza sına ihtiyacım var.",
           "english_sentence": "I need my father’s signature to get this credit card."
        },
        {
           "id": 873,
           "turkish_word": "yıllar",
           "english_word": "years",
           "type": "n pl",
           "turkish_sentence": "Yıllar ne kadar da çabuk geçiyor, bugün 30 yaşıma girdiğime inanamıyorum.",
           "english_sentence": "Years pass so quickly, I can’t believe I become thirty today."
        },
        {
           "id": 874,
           "turkish_word": "derin",
           "english_word": "deep",
           "type": "adj",
           "turkish_sentence": "Onunla her zaman derin konular hakkında konuşabiliyorum.",
           "english_sentence": "I can talk about deep subjects with her all the time."
        },
        {
           "id": 875,
           "turkish_word": "birer",
           "english_word": "one",
           "type": "adj",
           "turkish_sentence": "Aşağıdaki kelimeleri birer cümle içinde kullanınız.",
           "english_sentence": "Please make one sentence with each of the words below."
        },
        {
           "id": 876,
           "turkish_word": "gücü",
           "english_word": "power of",
           "type": "n poss",
           "turkish_sentence": "Kadının gücü hafife alınamaz!",
           "english_sentence": "Women’s power cannot be underestimated!"
        },
        {
           "id": 877,
           "turkish_word": "ağustos",
           "english_word": "August",
           "type": "n",
           "turkish_sentence": "30 Ağustos, Türkiye’nin milli Zafer Bayramı’dır.",
           "english_sentence": "August 30 is the national Victory Day of Turkey."
        },
        {
           "id": 878,
           "turkish_word": "dedim",
           "english_word": "I said",
           "type": "v",
           "turkish_sentence": "Patronuma “İşten bir günlük izin almaya ihtiyacım var,” dedim.",
           "english_sentence": "I told my boss that I need a day off."
        },
        {
           "id": 879,
           "turkish_word": "vahşi",
           "english_word": "wild",
           "type": "adj",
           "turkish_sentence": "Avusturalya’daki kuzenim vahşi yaşam fotoğrafçısı.",
           "english_sentence": "My cousin in Australia is a wild animal photographer."
        },
        {
           "id": 880,
           "turkish_word": "elektrik",
           "english_word": "electricity",
           "type": "n",
           "turkish_sentence": "Yarın saat 15.00’de 2 saatlik bir elektrik kesintisi olacak.",
           "english_sentence": "There will be an electricity cut for 2 hours tomorrow at 15:00."
        },
        {
           "id": 881,
           "turkish_word": "binlerce",
           "english_word": "thousands of",
           "type": "adj",
           "turkish_sentence": "Binlerce insan yeni yılı coşkuyla kutladı.",
           "english_sentence": "Thousands of people celebrated the new year with excitement."
        },
        {
           "id": 882,
           "turkish_word": "olmak",
           "english_word": "to be",
           "type": "adv",
           "turkish_sentence": "Her zaman ona karşı nazik olma ya çalıştım.",
           "english_sentence": "I’ve always tried to be kind to him.",
           "notes": "something"
        },
        {
           "id": 883,
           "turkish_word": "sağ",
           "english_word": "right",
           "type": "adj",
           "turkish_sentence": "Sağ kolumu kırdığım için sol elimle yemek yemek zorundayım.",
           "english_sentence": "As I broke my right arm, I have to eat with my left arm instead."
        },
        {
           "id": 884,
           "turkish_word": "temsil",
           "english_word": "representative",
           "type": "n",
           "turkish_sentence": "Şirketimizi temsil etmekten gurur duyarım.",
           "english_sentence": "I would be proud to be the representative of our company."
        },
        {
           "id": 885,
           "turkish_word": "et",
           "english_word": "meat",
           "type": "n",
           "turkish_sentence": "Et ürünleri yüksek oranda protein içerir.",
           "english_sentence": "Meat products include high levels of protein. "
        },
        {
           "id": 886,
           "turkish_word": "içindeki",
           "english_word": "which is inside of",
           "type": "adj",
           "turkish_sentence": "Kutunun içindeki pasta sana mı ait?",
           "english_sentence": "Does the cake inside of the box belong to you?"
        },
        {
           "id": 887,
           "turkish_word": "etmek",
           "english_word": "doing",
           "type": "v",
           "turkish_sentence": "Oyunu kazanmak için başka ne etme si gerek bilmiyorum.",
           "english_sentence": "I don’t know what else he needs to do to win the game."
        },
        {
           "id": 888,
           "turkish_word": "zira",
           "english_word": "because",
           "type": "conj",
           "turkish_sentence": "Umarım yarın geç kalmazsın zira bekletilmekten hiç hoşlanmam.",
           "english_sentence": "I hope you aren’t late tomorrow because I don’t like to be kept waiting."
        },
        {
           "id": 889,
           "turkish_word": "kuzey",
           "english_word": "north",
           "type": "n",
           "turkish_sentence": "Türkiye’nin kuzey inde çay ve fındık yetişir.",
           "english_sentence": "Tea and hazelnuts are grown in the north part of Turkey."
        },
        {
           "id": 890,
           "turkish_word": "Bursa",
           "english_word": "Bursa",
           "type": "n",
           "turkish_sentence": "Bursa Marmara Bölgesi’nde olan bir şehirdir.",
           "english_sentence": "Bursa is a city in the Marmara Region.",
           "notes": "a city in Turkey"
        },
        {
           "id": 891,
           "turkish_word": "kişiler",
           "english_word": "persons, people",
           "type": "n pl",
           "turkish_sentence": "Kişiler arasında çeşitli anlaşmazlıklar olabilir.",
           "english_sentence": "There may be various misunderstandings between people. "
        },
        {
           "id": 892,
           "turkish_word": "günde",
           "english_word": "in a day",
           "type": "prep",
           "turkish_sentence": "Bu ilacı günde 3 kez içmen gerek.",
           "english_sentence": "You need to take this medicine 3 times a day."
        },
        {
           "id": 893,
           "turkish_word": "aydın",
           "english_word": "literate/intellectual",
           "type": "adj",
           "turkish_sentence": "Ülkemizin birçok aydın kişiye ihtiyacı var.",
           "english_sentence": "Our country needs many literate people."
        },
        {
           "id": 894,
           "turkish_word": "olacağını",
           "english_word": "that",
           "type": "ptcp",
           "turkish_sentence": "Böyle olacağını nereden bilebilirim ki?",
           "english_sentence": "How can I know that these things would happen ?",
           "notes": "it"
        },
        {
           "id": 895,
           "turkish_word": "dünyaya",
           "english_word": "to the world",
           "type": "adv",
           "turkish_sentence": "Dünyaya sadece bir kez gelebiliriz.",
           "english_sentence": "We can come to the world only once."
        },
        {
           "id": 896,
           "turkish_word": "söyleyen",
           "english_word": "saying",
           "type": "ptcp",
           "turkish_sentence": "Bunu söyleyen kişiyi biliyor musun?",
           "english_sentence": "Do you know the person saying this?"
        },
        {
           "id": 897,
           "turkish_word": "etkisi",
           "english_word": "effect of",
           "type": "n poss",
           "turkish_sentence": "Onun çocuğu üzerinde babasının etkisi çok büyük.",
           "english_sentence": "His father’s effect on his child is very big."
        },
        {
           "id": 898,
           "turkish_word": "önümüzdeki",
           "english_word": "upcoming",
           "type": "adv",
           "turkish_sentence": "Önümüzdeki yıl çok şey değişecek.",
           "english_sentence": "So many things will change in the upcoming year."
        },
        {
           "id": 899,
           "turkish_word": "kaydetti",
           "english_word": "saved",
           "type": "v",
           "turkish_sentence": "Saatlerdir uğraştığı dosyayı sonunda kaydetti.",
           "english_sentence": "She finally saved the file she worked on for hours."
        },
        {
           "id": 900,
           "turkish_word": "neredeyse",
           "english_word": "almost",
           "type": "adv",
           "turkish_sentence": "Bugün neredeyse hiçbir şey yemedim.",
           "english_sentence": "I almost haven’t eaten anything today."
        },
        {
           "id": 901,
           "turkish_word": "Beşiktaş",
           "english_word": "A place in Istanbul/a football team in Turkey",
           "type": "n",
           "turkish_sentence": "Küçüklüğümden beri ailemle birlikte hep Beşiktaş 'ı desteklemişizdir ve bu asla değişmeyecek.",
           "english_sentence": "Ever since I was young, I've been supporting Beşiktaş with my family and this will never change."
        },
        {
           "id": 902,
           "turkish_word": "ilginç",
           "english_word": "interesting",
           "type": "adj",
           "turkish_sentence": "Üniversite hayatım boyunca birçok ilginç insanla tanıştım ve arkadaş oldum.",
           "english_sentence": "I've met and been friends with so many interesting people in my university years."
        },
        {
           "id": 903,
           "turkish_word": "edilmiş",
           "english_word": "had been done",
           "type": "v",
           "turkish_sentence": "Partiye eski sevgilim de davet edilmiş ti, bu yüzden ben gitmek istemedim.",
           "english_sentence": "My ex-boyfriend had been also invited to party, so I didn’t want to go.",
           "notes": "auxiliary verb used with nouns"
        },
        {
           "id": 904,
           "turkish_word": "dini",
           "english_word": "religious",
           "type": "adj",
           "turkish_sentence": "Türkiye'de dinî eğitim veren birçok resmi kurum bulabilirsiniz.",
           "english_sentence": "You can find so many institutions that provide religious education in Turkey."
        },
        {
           "id": 905,
           "turkish_word": "birden",
           "english_word": "suddenly",
           "type": "adv",
           "turkish_sentence": "Sınavı geçtiğini öğrenince birden sınıfın ortasında çığlık atmaya başladı.",
           "english_sentence": "When she learned that she passed the exam, she suddenly started to scream in the middle of the class."
        },
        {
           "id": 906,
           "turkish_word": "İbrahim",
           "english_word": "Ibrahim",
           "type": "n",
           "turkish_sentence": "Lisedeyken en iyi arkadaşım İbrahim ile okulda her türlü belaya bulaşmıştık.",
           "english_sentence": "When I was in high school, I was into all kinds of trouble at school with my best friend Ibrahim.",
           "notes": "a male name in Turkey"
        },
        {
           "id": 907,
           "turkish_word": "demokrasi",
           "english_word": "democracy",
           "type": "n",
           "turkish_sentence": "Demokrasi nin en doğru yönetim biçimi olduğuna inanıyor musun?",
           "english_sentence": "Do you believe that democracy is the best method to run a country?"
        },
        {
           "id": 908,
           "turkish_word": "adı",
           "english_word": "",
           "type": "n",
           "turkish_sentence": "Bu şehir adı nı nereden almış hikayesini anlatmamı ister misin?",
           "english_sentence": "Do you want me to tell you the story about how this city got its name ?",
           "notes": "his/her/its"
        },
        {
           "id": 909,
           "turkish_word": "oyuncu",
           "english_word": "player",
           "type": "n",
           "turkish_sentence": "Beş yaşından beri futbol oyuncu su olmanın hayalini kuruyor.",
           "english_sentence": "He's dreaming of being a football player ever since he was 5 years old."
        },
        {
           "id": 910,
           "turkish_word": "ediyoruz",
           "english_word": "doing",
           "type": "v",
           "turkish_sentence": "Bu yıl da size en iyi hizmeti vermeye devam ediyoruz.",
           "english_sentence": "We kept doing the best service for you this year."
        },
        {
           "id": 911,
           "turkish_word": "ten",
           "english_word": "skin",
           "type": "n",
           "turkish_sentence": "Açık ten li olduğum için, güneş altına korumasız çıkarsam cildim zarar görüyor.",
           "english_sentence": "Because I have light skin, I get damage to my skin easily if I go under sunlight without protection."
        },
        {
           "id": 912,
           "turkish_word": "demektir",
           "english_word": "means",
           "type": "v",
           "turkish_sentence": "Mutluluk sabır gerektirir, sabır ise aynı zamanda saygı demektir.",
           "english_sentence": "Happiness requires patience and patience means respect."
        },
        {
           "id": 913,
           "turkish_word": "aylık",
           "english_word": "monthly",
           "type": "adj",
           "turkish_sentence": "Aylık maaşına ek olarak bir kafede çalışarak ek gelir kazanmaya çalışıyor.",
           "english_sentence": "In addition to her monthly salary, she works in a café for extra money."
        },
        {
           "id": 914,
           "turkish_word": "yeri",
           "english_word": "",
           "type": "n",
           "turkish_sentence": "Elimde o kadar eşyayla ayakta kaldığımı görünce yeri ni bana verdi.",
           "english_sentence": "He gave me his seat when he saw me with so much stuff in my hands.",
           "notes": "someone's"
        },
        {
           "id": 915,
           "turkish_word": "isimli",
           "english_word": "named",
           "type": "adj",
           "turkish_sentence": "Büşra isimli uzun boylu bir kızı arıyorum.",
           "english_sentence": "I am looking for a tall girl named Büşra."
        },
        {
           "id": 916,
           "turkish_word": "çok",
           "english_word": "so much",
           "type": "adv",
           "turkish_sentence": "Kardeşimin aksine ben tatlı yemeyi çok seviyorum.",
           "english_sentence": "I love eating sweet foods so much, contrary to my sister."
        },
        {
           "id": 917,
           "turkish_word": "giren",
           "english_word": "entering",
           "type": "ptcp",
           "turkish_sentence": "Bu üniversiteye giren bir kişi ya çok zekidir ya da çok çalışmıştır.",
           "english_sentence": "Anyone entering this university is either smart or has worked so hard."
        },
        {
           "id": 918,
           "turkish_word": "bölgede",
           "english_word": "in",
           "type": "prep",
           "turkish_sentence": "Devlet bu bölgede yaşayan hayvanlar için koruma kararı aldı.",
           "english_sentence": "The govenment decided to protect the animals living in this region.",
           "notes": "this/a/the"
        },
        {
           "id": 919,
           "turkish_word": "sağlamak",
           "english_word": "provide",
           "type": "v",
           "turkish_sentence": "Devlet okulunda öğretmenlik yapmak bana birçok olanak sağlamak ta.",
           "english_sentence": "Being a teacher in a public school provides so many opportunities to me."
        },
        {
           "id": 920,
           "turkish_word": "üzerindeki",
           "english_word": "on",
           "type": "prep/postp",
           "turkish_sentence": "Masanın üzerindeki kitapların hepsini bu hafta bitirmek zorundayım.",
           "english_sentence": "I have to finish reading all the books on the table this week."
        },
        {
           "id": 921,
           "turkish_word": "Hasan",
           "english_word": "Hasan",
           "type": "n",
           "turkish_sentence": "Yeni doğan çocuklarına dedesinin adı olan Hasan adını verdiler.",
           "english_sentence": "They named their newborn child Hasan, which is his grandfather's name.",
           "notes": "a male name in Turkish"
        },
        {
           "id": 922,
           "turkish_word": "ilan",
           "english_word": "advertisement",
           "type": "n",
           "turkish_sentence": "İlan da yeni açılacak olan AVM'nin herkese sürpriz hediyeleri olduğunu okudum.",
           "english_sentence": "I read that the new shopping mall has so many surprises for everyone in the advertisement."
        },
        {
           "id": 923,
           "turkish_word": "kişilik",
           "english_word": "personality",
           "type": "n",
           "turkish_sentence": "Kişilik özellikleri uyuşmazsa hiçbir ilişki sağlıklı yürüyemez.",
           "english_sentence": "No relationship can work if the personalities don't match with each other."
        },
        {
           "id": 924,
           "turkish_word": "kaynak",
           "english_word": "resource",
           "type": "n",
           "turkish_sentence": "Orta Doğu'da çok önemli doğal kaynak lar olduğu için geçmişte birçok ülke tarafından işgal altına alınmıştır.",
           "english_sentence": "As there are so many important natural resources in Middle East, it was occupied by so many countries in the past."
        },
        {
           "id": 925,
           "turkish_word": "verir",
           "english_word": "gives",
           "type": "v",
           "turkish_sentence": "Öğretmenim her gün derse geldiginde bize minik hediyeler verir.",
           "english_sentence": "My teacher gives us small gifts every day when he comes to the class."
        },
        {
           "id": 926,
           "turkish_word": "büyükşehir",
           "english_word": "metropolis",
           "type": "n",
           "turkish_sentence": "İstanbul, Ankara, İzmir gibi şehirler büyükşehir örnekleridir.",
           "english_sentence": "Cities like Istanbul, Ankara, or Izmir are examples for metropolis."
        },
        {
           "id": 927,
           "turkish_word": "kültürel",
           "english_word": "cultural",
           "type": "adj",
           "turkish_sentence": "Kültürel geziler düzenlemek, öğrencilere her zaman faydalı olmuştur.",
           "english_sentence": "Arranging cultural travels has always been beneficial for students."
        },
        {
           "id": 928,
           "turkish_word": "ülkemizde",
           "english_word": "in our country",
           "type": "prep",
           "turkish_sentence": "Ülkemizde milyonlarca genç üniversite mezunu işsiz.",
           "english_sentence": "Millions of young university graduates are unemployed in our country."
        },
        {
           "id": 929,
           "turkish_word": "doğan",
           "english_word": "born",
           "type": "ptcp",
           "turkish_sentence": "Ocak ayının ilk gününde doğan çocuklara hediye verilecektir.",
           "english_sentence": "There will be presents for the children born on the first day of January."
        },
        {
           "id": 930,
           "turkish_word": "gizli",
           "english_word": "secret",
           "type": "adv",
           "turkish_sentence": "Polis, ünlü şarkıcının evindeki hırsızlık olayını gizli tutmasını istedi.",
           "english_sentence": "A famous singer was asked to keep the robbery incident in his house secret by the police."
        },
        {
           "id": 931,
           "turkish_word": "kapalı",
           "english_word": "closed",
           "type": "adv",
           "turkish_sentence": "Yılbaşı tatilinde birçok restoran, kafe ve market kapalı olacağı için önceden hazırlıklı olmalısınız.",
           "english_sentence": "You need to be prepared beforehand because many restaurants, cafés, and markets will be closed during Christmas holiday."
        },
        {
           "id": 932,
           "turkish_word": "buraya",
           "english_word": "here",
           "type": "prep",
           "turkish_sentence": "Buraya gelmeden önce hakkında birçok kitap okudum ancak yine de şehir planı çok karışık geliyor.",
           "english_sentence": "I read so many books about it before I came here, but still the city plan is so complicated."
        },
        {
           "id": 933,
           "turkish_word": "odası",
           "english_word": "",
           "type": "n poss",
           "turkish_sentence": "Kemal'in odası çok dağınık olduğundan Ayça'nın odası na geçelim.",
           "english_sentence": "Because Kemal's room is so untidy, let's switch to Ayça's room.",
           "notes": "someone's"
        },
        {
           "id": 934,
           "turkish_word": "emniyet",
           "english_word": "safety",
           "type": "n",
           "turkish_sentence": "Araba içerisindeyken emniyet kemeri kullanmayı hiçbir zaman unutmayalım.",
           "english_sentence": "When we are in a car, please always remember to use a safety belt."
        },
        {
           "id": 935,
           "turkish_word": "getirdi",
           "english_word": "brought",
           "type": "v",
           "turkish_sentence": "Sağanak kar maalesef beraberinde birçok trafik kazasını da getirdi.",
           "english_sentence": "Unfortunately, heavy snow also brought about many traffic accidents."
        },
        {
           "id": 936,
           "turkish_word": "alır",
           "english_word": "takes",
           "type": "v",
           "turkish_sentence": "Eğer bu yoldan gidersen parka varman yarım saati alır.",
           "english_sentence": "If you go in this way it takes half an hour to arrive at the park."
        },
        {
           "id": 937,
           "turkish_word": "olanlar",
           "english_word": "happenings",
           "type": "n pl",
           "turkish_sentence": "Dün gece olanlar için çok özür dilerim.",
           "english_sentence": "I am really sorry for the happenings from yesterday."
        },
        {
           "id": 938,
           "turkish_word": "işler",
           "english_word": "jobs",
           "type": "n",
           "turkish_sentence": "Bu kadar dolu bir özgeçmiş ile istediğin bütün işler i alırsın sen.",
           "english_sentence": "You can get all the jobs you want with this very full CV."
        },
        {
           "id": 939,
           "turkish_word": "şirket",
           "english_word": "company",
           "type": "n",
           "turkish_sentence": "15 yıldır şirket çalışanı olarak görev yapıyorum ama artık emekli olma vaktim geldi.",
           "english_sentence": "I've been working as a company employee for 15 years but now it's time for me to retire."
        },
        {
           "id": 940,
           "turkish_word": "yayın",
           "english_word": "broadcast",
           "type": "n",
           "turkish_sentence": "Bu televizyon kanalında daha önce canlı yayın deneyimim hiç olmamıştı, bu yüzden çok heyecanlıyım.",
           "english_sentence": "I've never had an experience of a live broadcast ; that's why I am so excited."
        },
        {
           "id": 941,
           "turkish_word": "Amerikan",
           "english_word": "American",
           "type": "adj",
           "turkish_sentence": "Yarın Amerikan bir turist grubuna Sultanahmet Camii'nde rehberlik yapacağım.",
           "english_sentence": "Tomorrow I will guide an American tourist group in Sultan Ahmed Mosque."
        },
        {
           "id": 942,
           "turkish_word": "etmektedir",
           "english_word": "is doing",
           "type": "v",
           "turkish_sentence": "Geçmişte birçok şehirde yaşamış olan amcam şu anda İzmir'de ikamet etmektedir.",
           "english_sentence": "My uncle, who has lived in so many cities before, is now living in Izmir.",
           "notes": "verb-ing"
        },
        {
           "id": 943,
           "turkish_word": "eğitimi",
           "english_word": "education",
           "type": "nposs",
           "turkish_sentence": "Çocukların eğitimi bir ülkedeki her şeyden daha önemli olmalıdır.",
           "english_sentence": "The education of children should be more important than anything in a country."
        },
        {
           "id": 944,
           "turkish_word": "toplumun",
           "english_word": "society's",
           "type": "n",
           "turkish_sentence": "Bazen toplumun beklentileri ile kişinin beklentileri örtüşmeyebilir.",
           "english_sentence": "Sometimes a society's and individual's expectations cannot match with each other."
        },
        {
           "id": 945,
           "turkish_word": "hüseyin",
           "english_word": "Hussein",
           "type": "n",
           "turkish_sentence": "Bütün hocalarım arasından en çok matematik öğretmenim Hüseyin Hoca'yı seviyorum.",
           "english_sentence": "Among all my teachers, I love my mathematics teacher Mr. Hussein the most.",
           "notes": "a male name in Turkish"
        },
        {
           "id": 946,
           "turkish_word": "çeken",
           "english_word": "pulling",
           "type": "ptcp",
           "turkish_sentence": "Dün gece o kadar yorgunum ki üzerime battaniyeyi çeken kim, hatırlamıyorum bile.",
           "english_sentence": "Last night I was so tired that I don't even remember anyone pulling the blanket on me."
        },
        {
           "id": 947,
           "turkish_word": "yazılı",
           "english_word": "written",
           "type": "adv",
           "turkish_sentence": "Üzerinde adımın yazılı olduğu defteri bana uzatır mısın?",
           "english_sentence": "Can you give me the notebook that my name is written on?"
        },
        {
           "id": 948,
           "turkish_word": "Kıbrıs",
           "english_word": "Cyprus",
           "type": "n",
           "turkish_sentence": "Kıbrıs Türkiye'nin güneyinde yer alan bir ada ülkesidir.",
           "english_sentence": "Cyprus is an island country located to the south of Turkey."
        },
        {
           "id": 949,
           "turkish_word": "hedef",
           "english_word": "target",
           "type": "n",
           "turkish_sentence": "Hedefi tutturabilmek için bütün konsantrasyonunu toplamak zorundasın.",
           "english_sentence": "You have to be fully concentrated to reach the target."
        },
        {
           "id": 950,
           "turkish_word": "diyen",
           "english_word": "saying",
           "type": "ptcp",
           "turkish_sentence": "Pes etme diyen bir arkadaşın olması insana her zaman çok yardımcı oluyor.",
           "english_sentence": "Having a friend saying “never give up” all the time helps you a lot."
        },
        {
           "id": 951,
           "turkish_word": "MHP",
           "english_word": "Nationalist Movement Party",
           "type": "n",
           "turkish_sentence": "Son başkanlık seçimlerinde MHP halktan yüzde 20'lik bir oy aldı.",
           "english_sentence": "In the last presidential elections, the Nationalist Movement Party got 20% of the votes from the public."
        },
        {
           "id": 952,
           "turkish_word": "kadınlar",
           "english_word": "women",
           "type": "n",
           "turkish_sentence": "Bazı durumlarda kadınların halini yalnızca kadınlar anlayabilir, bu yüzden ona biraz zaman ver.",
           "english_sentence": "In some situations only women can understand each other, that's why you must give her some time."
        },
        {
           "id": 953,
           "turkish_word": "bol",
           "english_word": "abundant",
           "type": "adj",
           "turkish_sentence": "Onda para bol, istediği her şeyi her zaman yapabilir; önemli olan bu parayı nasıl kullandığı.",
           "english_sentence": "Money is abundant for him, so he can do anything at any time; but the important thing is how he uses it."
        },
        {
           "id": 954,
           "turkish_word": "hızla",
           "english_word": "quickly",
           "type": "adv",
           "turkish_sentence": "Hızla içeriye göz attı ve kimse var mı yok mu diye kontrol etti.",
           "english_sentence": "He quickly glanced inside and checked if there was someone or not."
        },
        {
           "id": 955,
           "turkish_word": "olması",
           "english_word": "that he/she/it is",
           "type": "n",
           "turkish_sentence": "Yeni yılda kız kardeşimin üniversite sınavında başarılı olması nı diliyorum.",
           "english_sentence": "For the new year I wish my sister to be successful in her University entrance exam."
        },
        {
           "id": 956,
           "turkish_word": "anlamına",
           "english_word": "meaning",
           "type": "adv",
           "turkish_sentence": "Hocanın sınıftaki davranışları ne anlama geliyor anlayamadım.",
           "english_sentence": "I couldn't understand the meaning of the teacher’s behaviors in the class."
        },
        {
           "id": 957,
           "turkish_word": "vs.",
           "english_word": "etc.",
           "type": "adv",
           "turkish_sentence": "Marketten her zamanki şeyleri aldım: elma, muz, domates, vs.",
           "english_sentence": "I bought usual things in the grocery store: apple, banana, tomato, etc."
        },
        {
           "id": 958,
           "turkish_word": "halk",
           "english_word": "public",
           "type": "n",
           "turkish_sentence": "Türk halk ı her zaman yabancılara karşı misafirperver olmuştur.",
           "english_sentence": "The Turkish public has always been hospitable to foreigners."
        },
        {
           "id": 959,
           "turkish_word": "hasta",
           "english_word": "sick",
           "type": "n",
           "turkish_sentence": "Dün gece hasta olduğum için bugünkü dağ gezisine katılamadım.",
           "english_sentence": "I couldn't join the mountain trip today because I was sick last night."
        },
        {
           "id": 960,
           "turkish_word": "isim",
           "english_word": "name",
           "type": "n",
           "turkish_sentence": "Yeni doğan çocuklarına ne isim vereceklerine bir türlü karar veremediler.",
           "english_sentence": "They couldn't decide on which name to give to their newborn child."
        },
        {
           "id": 961,
           "turkish_word": "oldukları",
           "english_word": "that they/these/those are",
           "type": "ptcp pl",
           "turkish_sentence": "Şu anda diğer görevlilerimiz meşgul oldukları için sizi kısa süreli bekletmek zorundayız.",
           "english_sentence": "As all our personnel are busy right now, we have to make you wait for a short time."
        },
        {
           "id": 962,
           "turkish_word": "kısmı",
           "english_word": "part of",
           "type": "n",
           "turkish_sentence": "Projenin Büyük bir kısmı tamamlandığı için şu an yapacak çok bir şey kalmadı.",
           "english_sentence": "As the most part of the project is done, there are not so many things to do now."
        },
        {
           "id": 963,
           "turkish_word": "yoktu",
           "english_word": "was not/wasn't",
           "type": "v",
           "turkish_sentence": "Eve geldiğimde kedim evde yoktu, ben de hemen dışarıyı kontrol ettim.",
           "english_sentence": "When I came home, my cat wasn't there, so I checked outside immediately."
        },
        {
           "id": 964,
           "turkish_word": "yüzünden",
           "english_word": "because of",
           "type": "postp",
           "turkish_sentence": "Yağmur yüzünden yarınki piknik planı ertelenmek zorunda kaldı.",
           "english_sentence": "Because of the rain, tomorrow's picnic plan had to be postponed."
        },
        {
           "id": 965,
           "turkish_word": "çocukların",
           "english_word": "children's",
           "type": "n pl",
           "turkish_sentence": "Boşanma gibi durumlarda çocukların fikri de mutlaka alınmalı.",
           "english_sentence": "In cases like divorce, children's opinions must always be asked."
        },
        {
           "id": 966,
           "turkish_word": "devleti",
           "english_word": "state of",
           "type": "n",
           "turkish_sentence": "Amerika Birleşik Devlet leri birçok devletle diplomatik ilişkilerini gözden geçirmeye karar verdi.",
           "english_sentence": "The United State s of America has decided to review its diplomatic relations with many other countries."
        },
        {
           "id": 967,
           "turkish_word": "esas",
           "english_word": "real",
           "type": "adj",
           "turkish_sentence": "Sen bunları düşünmekten vazgeç, esas sorun kendisinden kaynaklı.",
           "english_sentence": "Stop thinking about these things, the real problem is because of him."
        },
        {
           "id": 968,
           "turkish_word": "puan",
           "english_word": "point",
           "type": "n",
           "turkish_sentence": "Bu oyunda ne kadar puan toplayabildiğinin bir önemi yok, tek önemli olan birinci olmak.",
           "english_sentence": "How many points you can collect doesn't matter in this game, the only important thing is to be the first."
        },
        {
           "id": 969,
           "turkish_word": "insan",
           "english_word": "human",
           "type": "n",
           "turkish_sentence": "İnsan ı diğer canlılardan ayıran en önemli özellik üstün zekamızdır.",
           "english_sentence": "The most important quality of a human that is different from other creatures is our developed intelligence."
        },
        {
           "id": 970,
           "turkish_word": "kurum",
           "english_word": "institution",
           "type": "n",
           "turkish_sentence": "Kurum başkanının dün geceki konuşması çok etkileyiciydi.",
           "english_sentence": "The speech of the institution 's president was very impressive."
        },
        {
           "id": 971,
           "turkish_word": "insanlara",
           "english_word": "to people",
           "type": "adv",
           "turkish_sentence": "Her zaman insanlara kolayca bağlandığı için, sonunda hayal kırıklığına uğruyor.",
           "english_sentence": "As she always attaches to people so easily, she feels disappointed at the end."
        },
        {
           "id": 972,
           "turkish_word": "yan",
           "english_word": "side",
           "type": "adj",
           "turkish_sentence": "Arkadaşımın verdiği notu gömleğimin yan cebine koydum.",
           "english_sentence": "I put the note my friend gave me in the side pocket of my shirt."
        },
        {
           "id": 973,
           "turkish_word": "mal",
           "english_word": "goods",
           "type": "n",
           "turkish_sentence": "Bu şirketten sadece en iyi kalitede mal çıktığı için, onların ürünlerine her zaman güvenirim.",
           "english_sentence": "As this company has only the best quality goods, I always trust its products."
        },
        {
           "id": 974,
           "turkish_word": "ihtiyacı",
           "english_word": "need of",
           "type": "n poss",
           "turkish_sentence": "Bu hastanın acil olarak O RH pozitif kana ihtiyacı var.",
           "english_sentence": "This patient is urgently in need of O positive blood intake."
        },
        {
           "id": 975,
           "turkish_word": "uyuyor",
           "english_word": "he/she/it sleeping",
           "type": "v",
           "turkish_sentence": "Dün gece eve o kadar geç geldi ki hala uyuyor.",
           "english_sentence": "She came home so late last night that she is still sleeping."
        },
        {
           "id": 976,
           "turkish_word": "doğrudan",
           "english_word": "directly",
           "type": "adv",
           "turkish_sentence": "Çok yorgun olduğum için okul çıkışında doğrudan eve gittim.",
           "english_sentence": "Because I was so tired, I went directly to home after school."
        },
        {
           "id": 977,
           "turkish_word": "üyeleri",
           "english_word": "members of",
           "type": "n poss",
           "turkish_sentence": "Avrupa Birliği üyeleri 2019 yılı süresince 28 ülkeden oluşmaktadır.",
           "english_sentence": "The members of the European Union consist of 28 countries as of 2019."
        },
        {
           "id": 978,
           "turkish_word": "bilinen",
           "english_word": "known",
           "type": "ptcp",
           "turkish_sentence": "Bir çeşit Japon mantısı olarak da bilinen Gyoza, orijinalde Çin mantısına benzer.",
           "english_sentence": "Gyoza, known as Japanese dumplings, are originally similar to Chinese dumplings."
        },
        {
           "id": 979,
           "turkish_word": "yurt",
           "english_word": "dormitory",
           "type": "n",
           "turkish_sentence": "Üniversitenin ilk 2 yılını yurt ta kalarak geçirdikten sonra eve çıktım.",
           "english_sentence": "After I spent my first two years in the university dormitory, I moved to an apartment."
        },
        {
           "id": 980,
           "turkish_word": "yılın",
           "english_word": "of the year",
           "type": "n",
           "turkish_sentence": "Yılın en bomba haberi, o ikisinin evlenme kararı alması oldu.",
           "english_sentence": "The most shocking news of the year was the marriage decision of those two."
        },
        {
           "id": 981,
           "turkish_word": "telefon",
           "english_word": "phone",
           "type": "n",
           "turkish_sentence": "Bana İlk telefon umu 12 yaşımdayken doğum günümde almışlardı.",
           "english_sentence": "They bought me my first phone when I was 12 years old, on my birthday."
        },
        {
           "id": 982,
           "turkish_word": "düşünce",
           "english_word": "thought",
           "type": "n",
           "turkish_sentence": "Bu üniversitede düşünce özgürlüğüne çok önem verilir.",
           "english_sentence": "In this university, the freedom of thought is given utmost importance."
        },
        {
           "id": 983,
           "turkish_word": "geç",
           "english_word": "late",
           "type": "adv",
           "turkish_sentence": "Ödevi geç teslim edersen, geç kaldığın gün başına beş puan kıracağım.",
           "english_sentence": "If you submit your homework late, I will take five points off per day you were late."
        },
        {
           "id": 984,
           "turkish_word": "aşk",
           "english_word": "love",
           "type": "n",
           "turkish_sentence": "Bu aşk uğruna çok şeyi göze aldım, ancak beklediğim karşılığı bulamadım.",
           "english_sentence": "I have faced so many things for the sake of this love, but I couldn't get the return I'd expected."
        },
        {
           "id": 985,
           "turkish_word": "bağımsız",
           "english_word": "independent",
           "type": "adj",
           "turkish_sentence": "Bir tasarım stüdyosunda 5 yıl çalıştıktan sonra kariyerine bağımsız sanatçı olarak devam etmeye karar verdi.",
           "english_sentence": "After working in a design studio for 5 years, she decided to continue as an independent artist."
        },
        {
           "id": 986,
           "turkish_word": "oyun",
           "english_word": "game",
           "type": "n",
           "turkish_sentence": "Bu oyun u oynamaktan artık çok sıkıldım, daha farklı oyunların yok mu?",
           "english_sentence": "I am so bored of playing this game, don't you have other games?"
        },
        {
           "id": 987,
           "turkish_word": "günümüzde",
           "english_word": "nowadays",
           "type": "adv",
           "turkish_sentence": "Günümüzde gençler tatil günlerini ailelerinin yanında geçirmektense yeni yerlere giderek değerlendiriyorlar.",
           "english_sentence": "Nowadays, young people use their holidays to try new places instead of visiting their families."
        },
        {
           "id": 988,
           "turkish_word": "halen",
           "english_word": "still",
           "type": "adv",
           "turkish_sentence": "Berlin'e taşınalı 2 yıl olmasına rağmen burada yaşamaya halen alışamadım.",
           "english_sentence": "Although it's been 2 years since I moved to Berlin, I still can’t get used to living here."
        },
        {
           "id": 989,
           "turkish_word": "dir",
           "english_word": "be",
           "type": "suf",
           "turkish_sentence": "En sevdiğim meyve kividir.",
           "english_sentence": "My favorite fruit is kiwi.",
           "notes": "am/is/are"
        },
        {
           "id": 990,
           "turkish_word": "bilimsel",
           "english_word": "scientific",
           "type": "adj",
           "turkish_sentence": "Bu laboratuvar detaylı bilimsel araştırma yapmaya elverişli değil, çünkü yeterli ekipman yok.",
           "english_sentence": "This laboratory is not useful for performing detailed scientific research as there's not enough equipment."
        },
        {
           "id": 991,
           "turkish_word": "ettiğini",
           "english_word": "doing",
           "type": "ptcp",
           "turkish_sentence": "Yemek yapmada annesine eşlik ettiğini görünce çok mutlu oldum.",
           "english_sentence": "I was so happy to see him accompanying his mother with cooking.",
           "notes": "verb-ing"
        },
        {
           "id": 992,
           "turkish_word": "-lik",
           "english_word": "-ship, -hood",
           "type": "suf",
           "turkish_sentence": "Üniversitemin birçok ülkeden üniversiteyle ortaklık anlaşması var.",
           "english_sentence": "My university has partnerships with other universities from different countries."
        },
        {
           "id": 993,
           "turkish_word": "sert",
           "english_word": "hard",
           "type": "adj",
           "turkish_sentence": "Bu şeftali henüz olgunlaşmamış gibi görünüyor çünkü bu hali yenmeyecek kadar sert.",
           "english_sentence": "This peach seems unripe because it's too hard to eat like this."
        },
        {
           "id": 994,
           "turkish_word": "kayıt",
           "english_word": "recording",
           "type": "n",
           "turkish_sentence": "Ünlü rock grubunun 20 yil öncesine ait konser kayıt ları yayınlandı.",
           "english_sentence": "The recording of the famous rock band's concert from 20 years ago has been published."
        },
        {
           "id": 995,
           "turkish_word": "başkanlığı",
           "english_word": "presidency of",
           "type": "n",
           "turkish_sentence": "Polis telsizinden ABD Başkanlığı Konutu'nun saldırı altında olduğu rapor edildi.",
           "english_sentence": "The USA Presidency Residence has been reported to be under attack from the police radio."
        },
        {
           "id": 996,
           "turkish_word": "başarı",
           "english_word": "success",
           "type": "n",
           "turkish_sentence": "Başarı emek ister; ancak istek olmazsa, emek tek başına bir işe yaramaz.",
           "english_sentence": "Success needs effort, but if there is no eagerness then effort alone cannot work."
        },
        {
           "id": 997,
           "turkish_word": "savaş",
           "english_word": "war",
           "type": "n",
           "turkish_sentence": "İkinci Dünya Savaş ı bir önceki dünya savaşı nda çözülemeyen problemlerden dolayı çıkmıştır.",
           "english_sentence": "World War II appeared because of the unsolved problems from the previous world war."
        },
        {
           "id": 998,
           "turkish_word": "olmadan",
           "english_word": "without",
           "type": "adv",
           "turkish_sentence": "Üniversiteyi ailesinin yardımı olmadan okuduğunu öğrendiğimde ona cok saygı duydum.",
           "english_sentence": "I respected him so much when I heard that he was studying in university without the support from his family."
        },
        {
           "id": 999,
           "turkish_word": "yılmaz",
           "english_word": "dauntless",
           "type": "adj",
           "turkish_sentence": "Onun eşitsizliklere karşı kolay kolay yılmaz bir karakteri vardır, hakkı için savaşır.",
           "english_sentence": "He has a dauntless personality against inequality, he fights for his rights."
        },
        {
           "id": 1000,
           "turkish_word": "takım",
           "english_word": "set; team",
           "type": "n",
           "turkish_sentence": "Doğum günü hediyesi olarak anneme pijama takım ı aldım.",
           "english_sentence": "I bought a pajamas set for my mother as a birthday present."
        },
        {
           "id": 1001,
           "turkish_word": "banka",
           "english_word": "bank",
           "type": "n",
           "turkish_sentence": "Banka bilgilerini doğru girdiğine emin misin?",
           "english_sentence": "Are you sure that you entered the bank details correctly?"
        },
        {
           "id": 1002,
           "turkish_word": "lütfen",
           "english_word": "please",
           "type": "interj",
           "turkish_sentence": "Lütfen kaldırımda yürürken diğer yayalara yer veriniz ve yere çöp atmayınız.",
           "english_sentence": "When you walk on the sidewalk, please give space to other pedestrians and don't throw away trash to the ground."
        },
        {
           "id": 1003,
           "turkish_word": "biliyorum",
           "english_word": "I know",
           "type": "v",
           "turkish_sentence": "Yaklaşık on yıldır bu şehirde yaşıyorum, dolayısıyla gidilmesi gereken yerlerin hepsini biliyorum.",
           "english_sentence": "I have been living in the city for approximately 10 years, therefore I know all the places that should be visited."
        },
        {
           "id": 1004,
           "turkish_word": "hey",
           "english_word": "hey, yo!",
           "type": "interj",
           "turkish_sentence": "Hey! Görüşmeyeli uzun zaman oldu, burada ne yapıyorsun?",
           "english_sentence": "Hey! It's been a long time since we talked, what are you doing here?"
        },
        {
           "id": 1005,
           "turkish_word": "Bay",
           "english_word": "mister",
           "type": "n",
           "turkish_sentence": "Yayınımızı ünlü şair Bay Nazım Hikmet'in \"Herkes Gibi\" adlı eseriyle sonlandırıyoruz.",
           "english_sentence": "We are ending our program with a poem named \"Herkes Gibi\" by famous poet Mister Nazım Hikmet."
        },
        {
           "id": 1006,
           "turkish_word": "tanrım",
           "english_word": "my god",
           "type": "n poss",
           "turkish_sentence": "Tanrım, bana yarınki iş görüşmesinde yardım et!",
           "english_sentence": "My God, help me for the job interview tomorrow!"
        },
        {
           "id": 1007,
           "turkish_word": "bilmiyorum",
           "english_word": "I don't know",
           "type": "v",
           "turkish_sentence": "Bu kadar olandan ve bana yaptıklarından sonra, onunla bir daha görüşür müyüm bilmiyorum.",
           "english_sentence": "After all these happenings and what he did to me, I don't know if I would still see him or not."
        },
        {
           "id": 1008,
           "turkish_word": "efendim",
           "english_word": "sir/madam",
           "type": "n",
           "turkish_sentence": "İyi akşamlar efendim, size nasıl yardımcı olabilirim?",
           "english_sentence": "Good evening sir, how can I help you?"
        },
        {
           "id": 1009,
           "turkish_word": "nerede",
           "english_word": "where",
           "type": "adv",
           "turkish_sentence": "Yarınki telafi dersi nerede ve ne zaman yapılacak biliyor musun?",
           "english_sentence": "Do you know where and when the make-up exam will be held?"
        },
        {
           "id": 1010,
           "turkish_word": "teşekkürler",
           "english_word": "thanks",
           "type": "interj",
           "turkish_sentence": "Dün gece ödül töreninde beni yalnız bırakmadığınız için çok teşekkürler, iyi ki varsınız!",
           "english_sentence": "Thanks for not leaving me alone at the award ceremony last night, I'm so glad to have you!"
        },
        {
           "id": 1011,
           "turkish_word": "merhaba",
           "english_word": "hello",
           "type": "interj",
           "turkish_sentence": "Her sabah okula gelirken kapıdaki güvenlik görevlisine merhaba derim.",
           "english_sentence": "I say hello to the security guard in the entrance when I come to school every morning."
        },
        {
           "id": 1012,
           "turkish_word": "işte",
           "english_word": "here you are",
           "type": "adv",
           "turkish_sentence": "Uzun bir aradan sonra işte buradasın!",
           "english_sentence": "Here you are after a long break!"
        },
        {
           "id": 1013,
           "turkish_word": "biliyor",
           "english_word": "s/he/it knows",
           "type": "v",
           "turkish_sentence": "Kemal Bey on yıllık bir öğretmen olarak zor bir öğrenci ile nasıl başa çıkması gerektiğini biliyor.",
           "english_sentence": "Mister Kemal knows how to cope with a difficult student, as a teacher for ten years."
        },
        {
           "id": 1014,
           "turkish_word": "harika",
           "english_word": "wonderful",
           "type": "adj",
           "turkish_sentence": "Erkek arkadaşı, Ayşe'nin doğum günü için harika bir sürpriz parti hazırlamış.",
           "english_sentence": "Ayşe's boyfriend prepared a wonderful surprise party for her birthday."
        },
        {
           "id": 1015,
           "turkish_word": "haydi",
           "english_word": "let's",
           "type": "interj",
           "turkish_sentence": "Haydi hep beraber akşam yemeğine Kadıköy'e gidelim!",
           "english_sentence": "Let's go to eat dinner all together in Kadıköy tonight!"
        },
        {
           "id": 1016,
           "turkish_word": "üzgünüm",
           "english_word": "I'm sorry",
           "type": "interj",
           "turkish_sentence": "Dün akşamki partide arkadaşımın agresif hareketlerinden dolayı sizi zor duruma soktuğum için üzgünüm.",
           "english_sentence": "I'm sorry for putting you in a difficult position because of the aggressive behaviors of my friend at last night's party."
        },
        {
           "id": 1017,
           "turkish_word": "ol",
           "english_word": "be",
           "type": "v",
           "turkish_sentence": "Başına her ne gelirse gelsin her zaman güçlü ol ve bunun üstesinden gelmeye çalış.",
           "english_sentence": "Whatever happens to you, always be strong and try to and get over it."
        },
        {
           "id": 1018,
           "turkish_word": "oh",
           "english_word": "ah",
           "type": "interj",
           "turkish_sentence": "Oh, sonunda aylardır uğraştığım tezimi bitirip bugün teslim edebilirim!",
           "english_sentence": "Ah, I could finally finish and submit my thesis that I was working on for months!",
           "notes": "a sigh of relief"
        },
        {
           "id": 1019,
           "turkish_word": "ver",
           "english_word": "give",
           "type": "v",
           "turkish_sentence": "Öğrenmek istediğin her şeyi sana söyledim, şimdi bana bunun karşılığını ver lütfen!",
           "english_sentence": "I told you everything you wanted to know, now please give me my reward in return!"
        },
        {
           "id": 1020,
           "turkish_word": "gel",
           "english_word": "come",
           "type": "v",
           "turkish_sentence": "Evimin kapısı sana her zaman açık, istediğin zaman gel ve keyfine bak.",
           "english_sentence": "The doors of my home are always open for you, come here whenever you want and enjoy your stay."
        },
        {
           "id": 1021,
           "turkish_word": "bayan",
           "english_word": "lady",
           "type": "n",
           "turkish_sentence": "Yeni öğrenci kayıt işlemleri için ilk olarak girişteki resepsiyonda bulunan bayan ile iletişime giriniz lütfen.",
           "english_sentence": "Please contact with the lady in the reception at the entrance for the new student registration procedures."
        },
        {
           "id": 1022,
           "turkish_word": "pekâlâ",
           "english_word": "all right",
           "type": "interj",
           "turkish_sentence": "Pekâlâ, bu seferlik seni affedeceğim, ama bir daha yapma lütfen. All right, I will forgive you for this time, but please don't do it again. ",
           "english_sentence": "     "
        },
        {
           "id": 1023,
           "turkish_word": "lanet",
           "english_word": "damn",
           "type": "adj",
           "turkish_sentence": "Bu lanet şirkette çalışmaktan yoruldum, istifa etmek istiyorum artık!",
           "english_sentence": "I am tired of working in this damn company, I want to quit!"
        },
        {
           "id": 1024,
           "turkish_word": "dur",
           "english_word": "stop",
           "type": "n",
           "turkish_sentence": "Yoldaki dur işaretini görmeden geçtiğim için trafik polisine yakalanıp para cezası aldım.",
           "english_sentence": "I was caught by the traffic cop and got a cash fine because I crossed the road without seeing the stop sign."
        },
        {
           "id": 1025,
           "turkish_word": "git",
           "english_word": "go",
           "type": "v",
           "turkish_sentence": "Artık 20 yaşındasın; istediğin yere git, istediğin şeyi yap!",
           "english_sentence": "You are twenty now; go wherever you want, do whatever you want!"
        },
        {
           "id": 1026,
           "turkish_word": "seninle",
           "english_word": "with you",
           "type": "prep",
           "turkish_sentence": "Seninle birlikte geçirdiğim süre boyunca hiçbir zaman mutsuz hissetmedim.",
           "english_sentence": "I have never felt unhappy during the time I had spent with you."
        },
        {
           "id": 1027,
           "turkish_word": "selam",
           "english_word": "hello",
           "type": "n",
           "turkish_sentence": "Bir kere bile bana selam vermeden güne başlamaz, her zaman hatrımı sorar.",
           "english_sentence": "He never starts a day without saying hello to me, he always asks about my well-being."
        },
        {
           "id": 1028,
           "turkish_word": "dostum",
           "english_word": "my friend",
           "type": "poss n",
           "turkish_sentence": "Ali benim çok yakın bir dostum dur, her ihtiyaç duyduğumda bana yardımcı olur.",
           "english_sentence": "Ali is my dear friend, he helps me every time I need it."
        },
        {
           "id": 1029,
           "turkish_word": "değilim",
           "english_word": "I am not",
           "type": "v",
           "turkish_sentence": "Hasta değilim ama çok yorgun hissediyorum, sanırım dinlenmeye ihtiyacım var.",
           "english_sentence": "I am not sick, but I feel so tired; I think I need to take a rest."
        },
        {
           "id": 1030,
           "turkish_word": "baba",
           "english_word": "father",
           "type": "n",
           "turkish_sentence": "Baba olmak kolay bir iş değil çünkü çok fazla sorumluluk üstlenmek zorunda kalıyorsunuz.",
           "english_sentence": "Being a father is not an easy job, because you need to take so many responsibilities."
        },
        {
           "id": 1031,
           "turkish_word": "yangın",
           "english_word": "fire",
           "type": "n",
           "turkish_sentence": "Yangın çabuk söndürüldüğü için ev fazla zarar görmedi.",
           "english_sentence": "The house did not suffer much damage because the fire was quickly put out."
        },
        {
           "id": 1032,
           "turkish_word": "benimle",
           "english_word": "with me",
           "type": "prep",
           "turkish_sentence": "Bu akşam, dışarıya akşam yemeği yemeye gidiyorum; benimle gelmek istersen haber ver lütfen.",
           "english_sentence": "I am going out to eat dinner tonight, if you want to come with me please let me know."
        },
        {
           "id": 1033,
           "turkish_word": "söyle",
           "english_word": "tell",
           "type": "v",
           "turkish_sentence": "Ne söylersen söyle, Kore'ye gitme kararımı değiştiremezsin çünkü biletimi çoktan aldım.",
           "english_sentence": "Tell me whatever you want, you can't change my mind about going to Korea, because I've already bought my ticket."
        },
        {
           "id": 1034,
           "turkish_word": "biliyorsun",
           "english_word": "you know",
           "type": "v",
           "turkish_sentence": "Biliyorsun ki her zaman ne olursa olsun senin yanında olacağım çünkü sen benim en yakın arkadaşımsın.",
           "english_sentence": "As you know, I will always be on your side in any case, because you are my best friend."
        },
        {
           "id": 1035,
           "turkish_word": "özür",
           "english_word": "apology",
           "type": "n",
           "turkish_sentence": "Bugün sınıfta öğretmen hakkında saygısızca konuştuğun için ona bir özür borçlusun.",
           "english_sentence": "As you talked disrespectfully about the teacher in today's class, you owe her an apology."
        },
        {
           "id": 1036,
           "turkish_word": "al",
           "english_word": "buy",
           "type": "v",
           "turkish_sentence": "Bu akşam yemekten sonra tiramisu yapmayı planlıyorum, eve gelirken un ve şeker al lütfen.",
           "english_sentence": "Tonight, I am planning to make tiramisu after dinner, please buy flour and sugar when you come home."
        },
        {
           "id": 1037,
           "turkish_word": "şunu",
           "english_word": "this",
           "type": "adv",
           "turkish_sentence": "Şunu da bitirdikten sonra başka işim kalmayacak, dışarı çıkabiliriz!",
           "english_sentence": "After I finish this, I won't have anything else to do, we can go out!"
        },
        {
           "id": 1038,
           "turkish_word": "istiyorsun",
           "english_word": "you want",
           "type": "v",
           "turkish_sentence": "Senin için her şeyi yaptım, benden daha başka ne istiyorsun ?",
           "english_sentence": "I did everything I could for you, what else do you want from me?"
        },
        {
           "id": 1039,
           "turkish_word": "yapıyorsun",
           "english_word": "you're doing",
           "type": "v",
           "turkish_sentence": "Yarın akşam ne yapıyorsun ?",
           "english_sentence": "What are you doing tomorrow?"
        },
        {
           "id": 1040,
           "turkish_word": "onunla",
           "english_word": "with him/her/it",
           "type": "adv",
           "turkish_sentence": "Onunla uzun süredir birlikte olduğum için karakterini çok iyi biliyorum.",
           "english_sentence": "As I've been with him for a long time, I know his character so well."
        },
        {
           "id": 1041,
           "turkish_word": "emin",
           "english_word": "sure",
           "type": "adj",
           "turkish_sentence": "Bu kadar çikolatanın kek için yeterli olacağından emin değilim de, biraz daha satın alır mısın?",
           "english_sentence": "I am not sure if this much chocolate is enough for the cake, can you buy some more?"
        },
        {
           "id": 1042,
           "turkish_word": "bakalım",
           "english_word": "let's see",
           "type": "interj",
           "turkish_sentence": "Bakalım ailesi olmadan başka bir şehirde yaşayabilecek mi.",
           "english_sentence": "Let's see if he can live in another city without his family."
        },
        {
           "id": 1043,
           "turkish_word": "miyim",
           "english_word": "do I/can I",
           "type": "interr",
           "turkish_sentence": "Sana bir soru sorabilir miyim ?",
           "english_sentence": "Can I ask you a question?"
        },
        {
           "id": 1044,
           "turkish_word": "bekle",
           "english_word": "wait",
           "type": "v",
           "turkish_sentence": "Okuldan sonra beni tren istasyonunun önünde bekle, arabayla seni almaya geleceğim.",
           "english_sentence": "Wait for me in front of the station after school, I will come there to pick you up by car."
        },
        {
           "id": 1045,
           "turkish_word": "buradan",
           "english_word": "from here",
           "type": "adv",
           "turkish_sentence": "Sizce yürüyerek buradan Armada AVM'ye kaç dakikada varırım?",
           "english_sentence": "How many minutes do you think it takes from here to Armada Mall if I walk?"
        },
        {
           "id": 1046,
           "turkish_word": "gidelim",
           "english_word": "",
           "type": "v",
           "turkish_sentence": "Haydi alışveriş merkezine kıyafet almaya gidelim, bu hafta birçok mağazada indirim var.",
           "english_sentence": "Let's go to the shopping mall to buy some clothes, so many stores have discounts this week.",
           "notes": "we"
        },
        {
           "id": 1047,
           "turkish_word": "eve",
           "english_word": "to home",
           "type": "adv",
           "turkish_sentence": "İşyerimden eve kadar otobüsle gitmek 50 dakika sürüyor, bu yüzden daha yakınlarda çalışabileceğim bir iş arıyorum.",
           "english_sentence": "It takes 50 minutes from my workplace to home, that's why I am looking for a job somewhere closer."
        },
        {
           "id": 1048,
           "turkish_word": "bırak",
           "english_word": "leave",
           "type": "v",
           "turkish_sentence": "Sen bu işi kabataslak bitir, geri kalanını bana bırak.",
           "english_sentence": "Finish the overall work, then leave the rest to me."
        },
        {
           "id": 1049,
           "turkish_word": "burası",
           "english_word": "here",
           "type": "adv",
           "turkish_sentence": "Burası güvenli bir yer değil, daha gizli bir yerde konuşalım.",
           "english_sentence": "Here is not a safe place, let's talk somewhere private."
        },
        {
           "id": 1050,
           "turkish_word": "nereye",
           "english_word": "where",
           "type": "adv",
           "turkish_sentence": "Yaz tatilinde nereye gitmek istiyorsun?",
           "english_sentence": "Where do you want to go for the summer holiday?"
        },
        {
           "id": 1051,
           "turkish_word": "olmalı",
           "english_word": "should be",
           "type": "v",
           "turkish_sentence": "Bu işin içinden çıkmanın bir çözüm yolu olmalı, ama bulamıyorum.",
           "english_sentence": "There should be a solution to get away from this situation, but I can't find it."
        },
        {
           "id": 1052,
           "turkish_word": "dinle",
           "english_word": "listen",
           "type": "v",
           "turkish_sentence": "Beni dinle lütfen, bu konuda tecrübeli olduğum için sana yardım etmek istiyorum.",
           "english_sentence": "Please listen to me, I want to help you because I am experienced in this topic."
        },
        {
           "id": 1053,
           "turkish_word": "istemiyorum",
           "english_word": "I don't want",
           "type": "v",
           "turkish_sentence": "Yarınki buluşmaya gelmek istemiyorum çünkü yapmam gereken bir sürü şey var.",
           "english_sentence": "I don't want to come to the meeting tomorrow, because I have lots of things to do."
        },
        {
           "id": 1054,
           "turkish_word": "dilerim",
           "english_word": "I wish",
           "type": "v",
           "turkish_sentence": "Yeni yılda sana sağlık ve başarı dilerim.",
           "english_sentence": "I wish you health and success for the new year."
        },
        {
           "id": 1055,
           "turkish_word": "benden",
           "english_word": "from me",
           "type": "adv",
           "turkish_sentence": "Benden ne istersen yaparım çünkü sana değer veriyorum.",
           "english_sentence": "I can do anything you want from me, because I value you."
        },
        {
           "id": 1056,
           "turkish_word": "aman",
           "english_word": "oh!",
           "type": "interj",
           "turkish_sentence": "Aman Allah'ım, sana ne oldu böyle? Ne kadar da değişmissin!",
           "english_sentence": "Oh my God, what happened to you? You've changed a lot!"
        },
        {
           "id": 1057,
           "turkish_word": "bir şey",
           "english_word": "something",
           "type": "n",
           "turkish_sentence": "Bu konu hakkında bir şey biliyorsan bana da açıklar mısın?",
           "english_sentence": "If you know something about this, can you also explain it to me?"
        },
        {
           "id": 1058,
           "turkish_word": "istiyor",
           "english_word": "",
           "type": "v",
           "turkish_sentence": "Annem üniversiteyi yurt dışında okumamı istiyor ama babam istemiyor.",
           "english_sentence": "My mom wants me to study abroad but not my father.",
           "notes": "someone"
        },
        {
           "id": 1059,
           "turkish_word": "tatlım",
           "english_word": "sweetheart",
           "type": "interj",
           "turkish_sentence": "Erkek arkadaşım bana hep \"tatlım \" diye seslenir.",
           "english_sentence": "My boyfriend always calls me \"sweetheart \"."
        },
        {
           "id": 1060,
           "turkish_word": "seviyorum",
           "english_word": "I like",
           "type": "v",
           "turkish_sentence": "Matematiği seviyorum ama çok zor olduğu zamanlarda sıkılıyorum ve motivasyonum düşüyor.",
           "english_sentence": "I like mathematics, but sometimes when it becomes too complicated, I feel bored and lose my motivation."
        },
        {
           "id": 1061,
           "turkish_word": "iki",
           "english_word": "two",
           "type": "num",
           "turkish_sentence": "Bu apartmanda iki yıldır yaşıyorum ama komşularımdan hiçbiri ile tanışmadım.",
           "english_sentence": "I have been living in this apartment for two years, yet still I haven't met with any of my neighbors."
        },
        {
           "id": 1062,
           "turkish_word": "misiniz",
           "english_word": "do you/can you",
           "type": "interr",
           "turkish_sentence": "Bana yardım edebilir misiniz lütfen? Can you help me please?",
           "english_sentence": "Buraya sık gelir misiniz ? Do you come here often?"
        },
        {
           "id": 1063,
           "turkish_word": "yapma",
           "english_word": "don't",
           "type": "v",
           "turkish_sentence": "Bu akşam için yemek yapma, yeni açılan restoranda iki kişilik rezervasyon yaptım.",
           "english_sentence": "Don't cook for dinner tonight, I've made a reservation for two people in the newly opened restaurant."
        },
        {
           "id": 1064,
           "turkish_word": "oraya",
           "english_word": "there",
           "type": "adv",
           "turkish_sentence": "Oraya vaktinde ulaşmam için taksi çağırmam gerek, aksi taktirde uçağa yetişmem mümkün değil.",
           "english_sentence": "I need to call a taxi to get there on time, otherwise it's impossible to catch the plane."
        },
        {
           "id": 1065,
           "turkish_word": "senden",
           "english_word": "from you",
           "type": "adv",
           "turkish_sentence": "Senin için sorun olmazsa, senden bir iyilik isteyebilir miyim?",
           "english_sentence": "Can I ask a favor from you, if it's all right with you?"
        },
        {
           "id": 1066,
           "turkish_word": "hoş",
           "english_word": "nice",
           "type": "adj",
           "turkish_sentence": "Mutfaktan hoş bir koku geliyor, sanırım biri kek yaptı.",
           "english_sentence": "There is a nice smell coming from the kitchen, I guess someone has made a cake."
        },
        {
           "id": 1067,
           "turkish_word": "yarın",
           "english_word": "tomorrow",
           "type": "adv",
           "turkish_sentence": "Ödevin teslim tarihinin yarın olduğunu bugün öğrendim, bu yüzden gece yarısına kadar bitirip göndermem gerek.",
           "english_sentence": "I've just learned that the deadline for the assignment is tomorrow, that's why I have to finish and submit it by midnight."
        },
        {
           "id": 1068,
           "turkish_word": "gidip",
           "english_word": "by going",
           "type": "ptcp",
           "turkish_sentence": "Son zamanlarda sürekli başım ağrıyor da, hastaneye gidip neden olduğunu öğrenmek istiyorum.",
           "english_sentence": "I have a chronic headache lately, so I want to learn the reason by going to the hospital."
        },
        {
           "id": 1069,
           "turkish_word": "edin",
           "english_word": "do/perform",
           "type": "aux",
           "turkish_sentence": "Polisler gaz bombası atıyor, yaralılara yardım edin !",
           "english_sentence": "The cops are throwing gas bombs, help the injured!",
           "notes": "auxilary verb used with nouns"
        },
        {
           "id": 1070,
           "turkish_word": "doktor",
           "english_word": "doctor",
           "type": "n",
           "turkish_sentence": "Küçüklüğümde hep doktor olmak istiyordum, ancak büyüyünce fikrimi değiştirdim ve mimar oldum.",
           "english_sentence": "I had always wanted to be a doctor when I was a child, but I changed my mind when I grew up and became an architect."
        },
        {
           "id": 1071,
           "turkish_word": "bakın",
           "english_word": "look",
           "type": "v",
           "turkish_sentence": "Şu fotoğrafa bir bakın ! Fotoğraftaki adam, hocamıza ne kadar da benziyor!",
           "english_sentence": "Look at this photo! The man in the photo looks so much like our teacher!"
        },
        {
           "id": 1072,
           "turkish_word": "dışarı",
           "english_word": "out",
           "type": "adv",
           "turkish_sentence": "Tam iki haftadır dışarı çıkmıyorum, sıkıntıdan patlamak üzereyim artık.",
           "english_sentence": "It's been two weeks since I didn't go out, now I am just about to die of boredom."
        },
        {
           "id": 1073,
           "turkish_word": "niye",
           "english_word": "why",
           "type": "adv inter",
           "turkish_sentence": "Bugün tatil olmasına rağmen niye erken uyandın?",
           "english_sentence": "Why did you wake up early, even though today is a holiday?"
        },
        {
           "id": 1074,
           "turkish_word": "gördüm",
           "english_word": "I saw",
           "type": "v pron",
           "turkish_sentence": "Dün alışveriş merkezinde ilkokul arkadaşımı gördüm, ama o beni görmediği için konuşamadık.",
           "english_sentence": "Yesterday, I saw my friend from elementary school, but we couldn't talk because she didn't see me."
        },
        {
           "id": 1075,
           "turkish_word": "kahretsin",
           "english_word": "damn it",
           "type": "interj",
           "turkish_sentence": "Kahretsin ! Yine otobüsü kaçırdım, şimdi otuz dakika beklemem gerek.",
           "english_sentence": "Damn it ! I've missed the bus again, now I have to wait for thirty minutes."
        },
        {
           "id": 1076,
           "turkish_word": "ihtiyacım",
           "english_word": "my need",
           "type": "n poss",
           "turkish_sentence": "Paraya olan ihtiyacım sosyal hayatımda ciddi problemlere sebep oluyor.",
           "english_sentence": "My need for money causes serious problems in my social life."
        },
        {
           "id": 1077,
           "turkish_word": "biri",
           "english_word": "someone",
           "type": "n",
           "turkish_sentence": "Perdeleri asmak için biri ne ihtiyacım var ama evde kimse yok.",
           "english_sentence": "I need someone to hang the curtains, but there is nobody in the house."
        },
        {
           "id": 1078,
           "turkish_word": "eminim",
           "english_word": "I am sure",
           "type": "adv",
           "turkish_sentence": "Eminim ki istersen üniversite sınavında çok başarılı olabilirsin, yeter ki kendine inan!",
           "english_sentence": "I am sure you can be very successful in the university exam, as long as you believe in yourself!"
        },
        {
           "id": 1079,
           "turkish_word": "sakin",
           "english_word": "quiet",
           "type": "adj",
           "turkish_sentence": "Bugün hafta içi olduğu için sokaklar sakin, sen bir de hafta sonları gör buraları.",
           "english_sentence": "The streets are quiet because today is a weekday, you should see here on the weekend."
        },
        {
           "id": 1080,
           "turkish_word": "nereden",
           "english_word": "from",
           "type": "adv",
           "turkish_sentence": "Üzerindeki elbiseyi nereden aldı merak ediyorum, ben de almak istiyorum da.",
           "english_sentence": "I wonder where she bought that dress from, as I also want to buy it."
        },
        {
           "id": 1081,
           "turkish_word": "falan",
           "english_word": "or so",
           "type": "n",
           "turkish_sentence": "Mutfakta hiçbir şey yok; yemek pişirmek için pirinç, sebze falan almam gerek.",
           "english_sentence": "There is nothing in the kitchen; I need to buy some rice, vegetables or so to cook."
        },
        {
           "id": 1082,
           "turkish_word": "gidiyor",
           "english_word": "is going",
           "type": "v",
           "turkish_sentence": "Görüşmeyeli her şey nasıl gidiyor ? Okula gidiyor musun?",
           "english_sentence": "How is everything going lately? Are you going to school?"
        },
        {
           "id": 1083,
           "turkish_word": "musunuz",
           "english_word": "are you",
           "type": "interr",
           "turkish_sentence": "Bu akşam partiye geliyor musunuz ?",
           "english_sentence": "Are you coming to the party tonight?"
        },
        {
           "id": 1084,
           "turkish_word": "yolculuk",
           "english_word": "trip",
           "type": "n",
           "turkish_sentence": "Ailem bir yolculuğ a çıktı ve ben evde yalnızım.",
           "english_sentence": "My parents are away on a trip and I'm alone in our house."
        },
        {
           "id": 1085,
           "turkish_word": "yalan",
           "english_word": "lie",
           "type": "n",
           "turkish_sentence": "İnternette hakkımda çıkan haberlerin hepsi yalan, inanmayın lütfen.",
           "english_sentence": "All the news about me on the internet are lies, please don't believe them."
        },
        {
           "id": 1086,
           "turkish_word": "gitti",
           "english_word": "went",
           "type": "v",
           "turkish_sentence": "Annem az önce markete gitti, yarım saat sonra geldiğinde size haber veririm.",
           "english_sentence": "My mom went to the supermarket just a moment ago, I will tell you when she comes back after half an hour."
        },
        {
           "id": 1087,
           "turkish_word": "değildi",
           "english_word": "wasn't/weren't",
           "type": "adv",
           "turkish_sentence": "Üniversiteye başladığında okuduğu bölümden memnun değildi, ancak ilerleyen yıllarda bölümünü sevmeye başladı.",
           "english_sentence": "When she started her university, she wasn't satisfied with her department, but in the following years she started to like it."
        },
        {
           "id": 1088,
           "turkish_word": "görüşürüz",
           "english_word": "see you",
           "type": "interj",
           "turkish_sentence": "Gelecek haftadaki dersimizde görüşürüz !",
           "english_sentence": "See you in our next week's class!"
        },
        {
           "id": 1089,
           "turkish_word": "çabuk",
           "english_word": "fast",
           "type": "adv",
           "turkish_sentence": "Doğrusu, bu kadar çabuk hazırlanacağını tahmin edemezdim.",
           "english_sentence": "I couldn't guess that he would be prepared this fast, in fact."
        },
        {
           "id": 1090,
           "turkish_word": "babam",
           "english_word": "my father",
           "type": "n poss",
           "turkish_sentence": "Babam her zaman, insanlara karşı sabırlı olursam onlarla daha iyi anlaşabileceğimi söyler.",
           "english_sentence": "My father always tells me if I am patient with people, I can get along with them more easily."
        },
        {
           "id": 1091,
           "turkish_word": "nefret",
           "english_word": "hate",
           "type": "n",
           "turkish_sentence": "Nefret duygusu çok güçlüdür, kişiye ciddi zarar verebilir.",
           "english_sentence": "The feeling of hate is so strong, it can harm someone seriously."
        },
        {
           "id": 1092,
           "turkish_word": "gördün",
           "english_word": "you saw",
           "type": "v",
           "turkish_sentence": "Dün gece televizyondaki haberi sen de gördün, değil mi?",
           "english_sentence": "You also saw the news on the TV last night, didn't you?"
        },
        {
           "id": 1093,
           "turkish_word": "umarım",
           "english_word": "I hope",
           "type": "adv",
           "turkish_sentence": "Umarım yarınki gösteride de provada yaptığım hataları tekrarlamam.",
           "english_sentence": "I hope I won't repeat the mistakes I did on the rehearsal for tomorrow's show."
        },
        {
           "id": 1094,
           "turkish_word": "sence",
           "english_word": "do you think",
           "type": "adv",
           "turkish_sentence": "Sence dışarı çıkarken ceket almalı mıyım, yoksa hava sıcak mı olur?",
           "english_sentence": "Do you think I should take a jacket with me when going out, or is the weather warm outside?"
        },
        {
           "id": 1095,
           "turkish_word": "öldü",
           "english_word": "died",
           "type": "v",
           "turkish_sentence": "Kardeşim yaklaşık bir haftadır ağlıyor çünkü kedimize araba çarptı ve öldü\r.",
           "english_sentence": "My sister has been crying for about one week because our cat was hit by a car and he died."
        },
        {
           "id": 1096,
           "turkish_word": "değilsin",
           "english_word": "you're not",
           "type": "adv",
           "turkish_sentence": "Henüz bara gitmek için yeterince büyük değilsin, 18 yaşını beklemen gerek.",
           "english_sentence": "You're not old enough to go to a bar now, you have to wait until you're 18."
        },
        {
           "id": 1097,
           "turkish_word": "ateş",
           "english_word": "fire",
           "type": "n",
           "turkish_sentence": "Kamp ateş i etrafında oturup şarkı söylemek istiyorum.",
           "english_sentence": "I want to sing a song while sitting around the fire."
        },
        {
           "id": 1098,
           "turkish_word": "yıllardır",
           "english_word": "for years",
           "type": "adv",
           "turkish_sentence": "Yıllardır aynı işi yapıyor ve herkes onu tanıyor.",
           "english_sentence": "He has been doing the same job for years and everyone knows him."
        },
        {
           "id": 1099,
           "turkish_word": "yaptım",
           "english_word": "I made/I did",
           "type": "v",
           "turkish_sentence": "Bugünkü sınavda çok büyük bir hata yaptım.",
           "english_sentence": "I made a big mistake in today's exam."
        },
        {
           "id": 1100,
           "turkish_word": "tanrı",
           "english_word": "God",
           "type": "n",
           "turkish_sentence": "Tanrı kavramı yüzyıllar boyunca filozoflar ve bilim insanları tarafindan tartışılmıştır.",
           "english_sentence": "The concept of God has been discussed by philisophers and scientists for centuries."
        },
        {
           "id": 1101,
           "turkish_word": "kes",
           "english_word": "cut",
           "type": "v",
           "turkish_sentence": "Soğanları ince ince kes ve tavada kızart lütfen.",
           "english_sentence": "Please cut the onions finely and fry in the pan."
        },
        {
           "id": 1102,
           "turkish_word": "Alper",
           "english_word": "Alper",
           "type": "n",
           "turkish_sentence": "Alper yeni bilgisayar almak için Efsane Cuma’yı bekliyor.",
           "english_sentence": "Alper is waiting for Black Friday to buy a new computer.",
           "notes": "masculine name"
        },
        {
           "id": 1103,
           "turkish_word": "yap",
           "english_word": "make",
           "type": "v",
           "turkish_sentence": "Ödevini dikkatli yap ki öğretmenin yüksek not verebilsin.",
           "english_sentence": "Do your homework carefully so that your teacher can give you a high grade."
        },
        {
           "id": 1104,
           "turkish_word": "olduğumu",
           "english_word": "that I am/was",
           "type": "ptcp",
           "turkish_sentence": "Gizli ajan olduğumu onlara söylemedim.",
           "english_sentence": "I didn’t tell them that I am a secret agent."
        },
        {
           "id": 1105,
           "turkish_word": "kendimi",
           "english_word": "myself",
           "type": "pron",
           "turkish_sentence": "Cuma günü projemi teslim ettikten sonra kendimi şımartmak için alışverişe gittim.",
           "english_sentence": "On Friday, after I submitted my project, I went shopping to treat myself."
        },
        {
           "id": 1106,
           "turkish_word": "aptal",
           "english_word": "stupid",
           "type": "adj",
           "turkish_sentence": "İyi bir üniversitede okumuyor olması, aptal olduğu anlamına gelmez.",
           "english_sentence": "Just because he is not studying in a good university, it doesn't mean that he is stupid."
        },
        {
           "id": 1107,
           "turkish_word": "istediğim",
           "english_word": "that I want",
           "type": "ptcp",
           "turkish_sentence": "Keşke istediğim her şeye sahip olabilseydim.",
           "english_sentence": "I wish I could have everything that I want."
        },
        {
           "id": 1108,
           "turkish_word": "hâlâ",
           "english_word": "still",
           "type": "adv",
           "turkish_sentence": "AVM'lerde birçok şey alıp para harcamasına rağmen hâlâ gezmeye yetecek kadar parası var.",
           "english_sentence": "Although he spends money by buying lots of things, he still has enough money to go out."
        },
        {
           "id": 1109,
           "turkish_word": "yeter",
           "english_word": "enough",
           "type": "v",
           "turkish_sentence": "Bu kadar oyalanmak yeter, artık herkes işinin başına dönsün!",
           "english_sentence": "It's enough of wasting time, now everyone should go back to their work!"
        },
        {
           "id": 1110,
           "turkish_word": "yaptın",
           "english_word": "you did",
           "type": "v",
           "turkish_sentence": "Bu kadar süre boyunca oyun oynamaktan başka ne yaptın, söyleyebilir misin?",
           "english_sentence": "Can you tell me what else you did other than playing games for all this time?"
        },
        {
           "id": 1111,
           "turkish_word": "pekâlâ",
           "english_word": "okay",
           "type": "interj",
           "turkish_sentence": "Pekâlâ, bu seferlik senin istedigin gibi olsun.",
           "english_sentence": "Okay, let's do it as you want for this time."
        },
        {
           "id": 1112,
           "turkish_word": "kal",
           "english_word": "stay",
           "type": "v",
           "turkish_sentence": "Artık yirmi yaşındasın, istersen gece boyunca dışarıda kal ; istediğini yapmakta özgürsün.",
           "english_sentence": "You are twenty years old now, stay out the whole night if you want; you're free to do what you want."
        },
        {
           "id": 1113,
           "turkish_word": "olamaz",
           "english_word": "can't be",
           "type": "v",
           "turkish_sentence": "Bu haber gerçek olamaz, çünkü benim tanıdığım Hasan öyle bir insan değil.",
           "english_sentence": "This news can't be true, because the Hasan I know is not a person like that."
        },
        {
           "id": 1114,
           "turkish_word": "adamım",
           "english_word": "my man",
           "type": "poss n] [interj",
           "turkish_sentence": "Seninle takılmak gerçekten çok eğlenceli, adamım !",
           "english_sentence": "Hanging out with you is really so fun, my man !"
        },
        {
           "id": 1115,
           "turkish_word": "bitti",
           "english_word": "finished",
           "type": "v",
           "turkish_sentence": "Buradaki işim bitti, artık eve dönme vaktim geldi.",
           "english_sentence": "My job here is finished, now it's time to go back home."
        },
        {
           "id": 1116,
           "turkish_word": "ettim",
           "english_word": "I did",
           "type": "aux",
           "turkish_sentence": "Onun teklifini kabul ettim.",
           "english_sentence": "I accepted his offer.",
           "notes": "auxilary verb used with nouns"
        },
        {
           "id": 1117,
           "turkish_word": "söyledim",
           "english_word": "I said",
           "type": "v",
           "turkish_sentence": "Bu kadar çok çalışırsa hayattaki başka fırsatları kaçıracağını ona söyledim.",
           "english_sentence": "I said to him that if he works so hard, he could miss the other chances in his life."
        },
        {
           "id": 1118,
           "turkish_word": "neyse",
           "english_word": "anyway",
           "type": "adv",
           "turkish_sentence": "Neyse artık, geçmişte olan geçmişte kalsın.",
           "english_sentence": "Anyway, what happened in the past should remain in the past."
        },
        {
           "id": 1119,
           "turkish_word": "adamı",
           "english_word": "the man",
           "type": "n",
           "turkish_sentence": "Şirketin halkla ilişkiler bölümüne atanan adamı tanıyor musun?",
           "english_sentence": "Do you know the man who was assigned to the public relations department of the company?"
        },
        {
           "id": 1120,
           "turkish_word": "ilk",
           "english_word": "first",
           "type": "adj",
           "turkish_sentence": "Bebeğin ilk adımlarını gören annesi, heyecanla eşini ve çocuklarını çağırıp onlara bebeği izlemelerini söyledi.",
           "english_sentence": "As the mother saw her baby's first steps, she called her husband and kids and told them to watch the baby."
        },
        {
           "id": 1121,
           "turkish_word": "Doruk",
           "english_word": "Doruk",
           "type": "n",
           "turkish_sentence": "Doruk dün gece arkadaşlarıyla bara gitti.",
           "english_sentence": "Doruk went to the bar with his friends last night.",
           "notes": "masculine name"
        },
        {
           "id": 1122,
           "turkish_word": "aldım",
           "english_word": "I took",
           "type": "v",
           "turkish_sentence": "Bu yemeği yapabilmek için mükemmel kalitede peynir gerekli, bu yüzden de Fransız arkadaşımdan biraz peynir aldim.",
           "english_sentence": "In order to cook this meal, there should be a perfect quality cheese; that's why I took some cheese from my French friend."
        },
        {
           "id": 1123,
           "turkish_word": "annem",
           "english_word": "my mom",
           "type": "n poss",
           "turkish_sentence": "Üniversiteye yeni başladığım zaman annem her gün beni arar, iyi olup olmadığımı sorardı.",
           "english_sentence": "When I started university, my mom would call me every day and ask me if I was okay or not."
        },
        {
           "id": 1124,
           "turkish_word": "konuşmak",
           "english_word": "to talk",
           "type": "v",
           "turkish_sentence": "Benimle akşam yemeği yemek ister misin? Seninle konuşmak istediğim önemli bir konu var da.",
           "english_sentence": "Do you want to eat dinner with me tonight? There is something important that I want to talk to you about."
        },
        {
           "id": 1125,
           "turkish_word": "buldum",
           "english_word": "I found",
           "type": "v",
           "turkish_sentence": "İki gün önce işyerimin etrafındaki sokaklarda dolaşırken çok iyi bir kafe buldum.",
           "english_sentence": "Two days ago, when I was walking in the streets around my workplace, I found a really good café."
        },
        {
           "id": 1126,
           "turkish_word": "zaman",
           "english_word": "time",
           "type": "n",
           "turkish_sentence": "Havalar gittikçe soğumaya başlıyor, bu yüzden de şimdi ceket almanın tam zamanı.",
           "english_sentence": "The weather is getting cold day by day, so now it's time to buy a winter jacket."
        },
        {
           "id": 1127,
           "turkish_word": "saniye",
           "english_word": "second",
           "type": "adv",
           "turkish_sentence": "Haşlanan sebzeleri yaklaşık otuz saniye kadar suda beklettikten sonra tavaya ekleyiniz.",
           "english_sentence": "After you pour water over the boiled vegetables for about thirty seconds, add them to the pan."
        },
        {
           "id": 1128,
           "turkish_word": "gitmek",
           "english_word": "to go",
           "type": "v",
           "turkish_sentence": "Bugün çok yorgunum ve dinlenmeye ihtiyacım var, bu yüzden de yarın okula gitmek istemiyorum.",
           "english_sentence": "Today, I am so tired and I need to rest, that's why I don't want to go to school tomorrow."
        },
        {
           "id": 1129,
           "turkish_word": "mükemmel",
           "english_word": "perfect",
           "type": "adv",
           "turkish_sentence": "En son yaptığın çikolatalı pasta mükemmel olmuştu, tarifini verir misin?",
           "english_sentence": "The chocolate cake that you made last time was perfect, can you give me the recipe?"
        },
        {
           "id": 1130,
           "turkish_word": "öyleyse",
           "english_word": "then",
           "type": "adv",
           "turkish_sentence": "Öyleyse yapacak bir şey yok, eve bir gece erken dönelim.",
           "english_sentence": "Then, there is nothing to do; let’s go back home one night earlier."
        },
        {
           "id": 1131,
           "turkish_word": "aç",
           "english_word": "hungry",
           "type": "adj",
           "turkish_sentence": "Sabah kahvaltı yapmadan dışarı çıktığım için şu an çok aç ım, hemen bir şeyler yemem lazım.",
           "english_sentence": "As I went out without eating breakfast, now I am so hungry ; I need to get something immediately."
        },
        {
           "id": 1132,
           "turkish_word": "içeri",
           "english_word": "inside",
           "type": "adv",
           "turkish_sentence": "İçeri girmek için 50 TL ödemeniz gerekiyor, yoksa sizi kabul edemeyiz.",
           "english_sentence": "You need to pay 50 Turkish liras to go inside, or else we can't accept you."
        },
        {
           "id": 1133,
           "turkish_word": "görünüyor",
           "english_word": "looks",
           "type": "v",
           "turkish_sentence": "Menüdeki tatlıların hepsi lezzetli görünüyor, hangisini sipariş etsem bilemedim.",
           "english_sentence": "Every dessert in the menu looks delicious, I don't know which one to order."
        },
        {
           "id": 1134,
           "turkish_word": "olun",
           "english_word": "be",
           "type": "v",
           "turkish_sentence": "Evlilik yıl dönümünüz kutlu olsun, birlikte ve mutlu olun hep.",
           "english_sentence": "I wish you happy wedding anniversary, always be happy and together."
        },
        {
           "id": 1135,
           "turkish_word": "bilirsin",
           "english_word": "you know",
           "type": "v",
           "turkish_sentence": "Beni bilirsin, beğenmediğim bir şey olduğu zaman bunu direk söylerim.",
           "english_sentence": "You know me, when I see something I don't like, I say it directly."
        },
        {
           "id": 1136,
           "turkish_word": "oldum",
           "english_word": "I become",
           "type": "v",
           "turkish_sentence": "Bugün tam olarak on sekiz oldum, artık bir yetişkin sayılırım.",
           "english_sentence": "Today I become eighteen, now I am almost an adult."
        },
        {
           "id": 1137,
           "turkish_word": "bebeğim",
           "english_word": "my baby",
           "type": "n poss",
           "turkish_sentence": "Bebeğim için en iyisi ne ise her zaman onu alırım.",
           "english_sentence": "I always buy what is the best for my baby."
        },
        {
           "id": 1138,
           "turkish_word": "sanmıyorum",
           "english_word": "I don't think",
           "type": "v",
           "turkish_sentence": "Doğum gününde ona çanta alabilirsin, fazla pahalı olacağını sanmıyorum.",
           "english_sentence": "You can buy her a bag for her birthday, I don't think it's going to be so expensive."
        },
        {
           "id": 1139,
           "turkish_word": "anlıyorum",
           "english_word": "I understand",
           "type": "v",
           "turkish_sentence": "Ne demek istediğini anlıyorum ancak benim de yapabileceğim bir şey yok.",
           "english_sentence": "I understand what you mean, but there is nothing I can do."
        },
        {
           "id": 1140,
           "turkish_word": "düşünüyorsun",
           "english_word": "you think",
           "type": "v",
           "turkish_sentence": "Yarınki parti için giyeceğim elbise hakkında ne düşünüyorsun ?",
           "english_sentence": "What do you think about the dress I will wear in tomorrow's party?"
        },
        {
           "id": 1141,
           "turkish_word": "geldim",
           "english_word": "I came",
           "type": "v",
           "turkish_sentence": "Bu okula, daha iyi bir eğitim almak ve İngilizcemi geliştirmek için geldim.",
           "english_sentence": "I came to this school to get a good education and improve my English."
        },
        {
           "id": 1142,
           "turkish_word": "araba",
           "english_word": "car",
           "type": "n",
           "turkish_sentence": "Otuz beş yaşında olmasına rağmen halen araba kullanmayı bilmiyor.",
           "english_sentence": "He doesn't know how to drive a car even though he is thirty-five."
        },
        {
           "id": 1143,
           "turkish_word": "söylemek",
           "english_word": "to tell",
           "type": "v",
           "turkish_sentence": "Sana söylemek istediğim şeyler var da, beş dakikalığına buraya gelir misin?",
           "english_sentence": "I have things that I want to tell you, so can you come over here for five minutes?"
        },
        {
           "id": 1144,
           "turkish_word": "adamın",
           "english_word": "the man's",
           "type": "n",
           "turkish_sentence": "Adamın sözlerine göre kaza gece 12 sularında marketin önünde gerçekleşmiş.",
           "english_sentence": "According to the man's words, the accident happened around 12 at night in front of the station."
        },
        {
           "id": 1145,
           "turkish_word": "evde",
           "english_word": "at home",
           "type": "n prep",
           "turkish_sentence": "Bütün gün evde hiçbir şey yapmadan oturdun, dışarı çıkmak istemiyor musun?",
           "english_sentence": "You've sat at home doing nothing all day, don't you want to go out?"
        },
        {
           "id": 1146,
           "turkish_word": "dersin",
           "english_word": "of the lesson",
           "type": "n",
           "turkish_sentence": "Dersin ortasında birden telefonum çalınca ne yapacağımı bilemedim.",
           "english_sentence": "I didn't know what to do when my phone rang in the middle of the lesson."
        },
        {
           "id": 1147,
           "turkish_word": "miyiz",
           "english_word": "can we",
           "type": "interr",
           "turkish_sentence": "Bu oyun çok eğlenceli, sizinle oynayabilir miyiz ?",
           "english_sentence": "This game is so much fun, can we play with you?"
        },
        {
           "id": 1148,
           "turkish_word": "galiba",
           "english_word": "probably",
           "type": "adv",
           "turkish_sentence": "Yarın galiba anneannemi görmeye memleketime gideceğim, çünkü onun hasta olduğunu duydum.",
           "english_sentence": "Tomorrow probably I will go to my hometown to see my grandmother, because I heard she was sick."
        },
        {
           "id": 1149,
           "turkish_word": "istedim",
           "english_word": "I wanted",
           "type": "v",
           "turkish_sentence": "Beraber kafeye gittik çünkü onunla bir konu hakkında görüşmek istedim.",
           "english_sentence": "We went to a café together because I wanted to talk with him about something."
        },
        {
           "id": 1150,
           "turkish_word": "ameliyat",
           "english_word": "surgery",
           "type": "n",
           "turkish_sentence": "Ameliyat tan çıktıktan sonra doktora sorduğu ilk şey neydi?",
           "english_sentence": "What was the first thing he asked the doctor after he came out of the surgery ?"
        },
        {
           "id": 1151,
           "turkish_word": "komik",
           "english_word": "funny",
           "type": "adj",
           "turkish_sentence": "Komik bir şaka yaptım ama kimse anlayamadığı için, gülen olmadı.",
           "english_sentence": "I made a funny joke, but no one laughed at it because they couldn't understand."
        },
        {
           "id": 1152,
           "turkish_word": "düşündüm",
           "english_word": "I thought",
           "type": "v",
           "turkish_sentence": "Bütün gece boyunca, bana ne demek istediğini düşündüm.",
           "english_sentence": "I thought about what you wanted me to say the whole night."
        },
        {
           "id": 1153,
           "turkish_word": "söylüyor",
           "english_word": "says",
           "type": "v",
           "turkish_sentence": "Gelecek yıl daha çok çalışacağını sürekli söylüyor ama çalışacağını sanmıyorum.",
           "english_sentence": "He always says he is going to study harder next year, but I don't think so."
        },
        {
           "id": 1154,
           "turkish_word": "oğlum",
           "english_word": "my son",
           "type": "n poss",
           "turkish_sentence": "Oğlum bu sene evleniyor, bu yüzden hepimiz çok heyecanlıyız.",
           "english_sentence": "My son is marrying this year, that's why all of us are so excited."
        },
        {
           "id": 1155,
           "turkish_word": "duydum",
           "english_word": "I heard",
           "type": "v",
           "turkish_sentence": "Geçen hafta yapılan sınavdan kimsenin A alamadığını duydum.",
           "english_sentence": "I heard that no one could get the A grade from last week's exam."
        },
        {
           "id": 1156,
           "turkish_word": "evlat",
           "english_word": "child",
           "type": "n",
           "turkish_sentence": "Henüz iki yıllık evliyiz, evlat sahibi olmak için çok erken olduğunu düşünüyoruz.",
           "english_sentence": "We're married for only two years, we think it's too early to have a child."
        },
        {
           "id": 1157,
           "turkish_word": "çocuğu",
           "english_word": "the kid",
           "type": "n",
           "turkish_sentence": "Ahmet çocuğu parka götürdü ve onu mahalledeki diğer çocuklarla tanıştırdı.",
           "english_sentence": "Ahmet took the kid to the park and introduced him to other children in the neighborhood."
        },
        {
           "id": 1158,
           "turkish_word": "silah",
           "english_word": "gun",
           "type": "n",
           "turkish_sentence": "Daha önce hayatımda hiç silah kullanmadım, kullanmak da istemiyorum.",
           "english_sentence": "I've never used a gun in my life, and I don't want to use it."
        },
        {
           "id": 1159,
           "turkish_word": "hepimiz",
           "english_word": "all of u s",
           "type": "pron",
           "turkish_sentence": "Sınav tarihinin gelecek haftaya ertelenmesi konusunda hepimiz hemfikiriz.",
           "english_sentence": "All of us agree on the postponing of the exam to next week."
        },
        {
           "id": 1160,
           "turkish_word": "şuna",
           "english_word": "at that",
           "type": "adv",
           "turkish_sentence": "Şuna bir bakın! Yavru kedi, annesiyle oyun oynuyor.",
           "english_sentence": "Look at that ! A kitty is playing with its mother."
        },
        {
           "id": 1161,
           "turkish_word": "çalışıyorum",
           "english_word": "I am working",
           "type": "v",
           "turkish_sentence": "Cumartesi günleri çalışıyorum, pazar günü buluşsak olur mu?",
           "english_sentence": "I am working on Saturdays, is it OK if we meet on Sunday?"
        },
        {
           "id": 1162,
           "turkish_word": "herif",
           "english_word": "guy",
           "type": "n",
           "turkish_sentence": "Şu herif iki saattir bana bakıp duruyor, çok rahatsız edici.",
           "english_sentence": "This guy keeps looking at me for two hours, it's so annoying."
        },
        {
           "id": 1163,
           "turkish_word": "vay",
           "english_word": "wow",
           "type": "interj",
           "turkish_sentence": "Vay be, seni burada göreceğim hiç aklıma gelmezdi!",
           "english_sentence": "Wow, I never expected to see you here!"
        },
        {
           "id": 1164,
           "turkish_word": "hayatım",
           "english_word": "my life",
           "type": "n poss",
           "turkish_sentence": "Hayatım boyunca hiçbir zaman marka bir kıyafetim olmadı.",
           "english_sentence": "I've never had a brand-name dress in my life."
        },
        {
           "id": 1165,
           "turkish_word": "gidiyorum",
           "english_word": "I am going",
           "type": "v",
           "turkish_sentence": "Gelecek sene Almanya'ya yüksek lisans yapmaya gidiyorum.",
           "english_sentence": "Next year I am going to Germany to do a master’s degree."
        },
        {
           "id": 1166,
           "turkish_word": "canavar",
           "english_word": "monster",
           "type": "n",
           "turkish_sentence": "Canavar lar tarih boyunca birçok antik efsanede ayrıntılı olarak tasvir edilmiştir.",
           "english_sentence": "Monsters are depicted in detail in many ancient legends throughout history."
        },
        {
           "id": 1167,
           "turkish_word": "korku",
           "english_word": "fear",
           "type": "n",
           "turkish_sentence": "Korku gölge gibidir, karanlıkla yüzleştiğin zaman kaybolur.",
           "english_sentence": "Fear is like a shadow, when you face the darkness it’s gone."
        },
        {
           "id": 1168,
           "turkish_word": "garip",
           "english_word": "weird",
           "type": "adj",
           "turkish_sentence": "Son zamanlarda davranışları çok garip ; bir sıkıntısı olmalı, ama nedir bilmiyorum.",
           "english_sentence": "Lately his behaviors are so weird ; he must have a problem, but I don't know what it is."
        },
        {
           "id": 1169,
           "turkish_word": "hayatta",
           "english_word": "never",
           "type": "adv",
           "turkish_sentence": "Yurt dışında yaşamasına hayatta izin vermem, önce başka bir şehirde tek başına yaşamayı öğrenmeli.",
           "english_sentence": "I never allowed him to live abroad; first, he should learn how to live by himself in another city."
        },
        {
           "id": 1170,
           "turkish_word": "olacağım",
           "english_word": "I will",
           "type": "v",
           "turkish_sentence": "Tıp fakültesini bitirdikten sonra pratisyen hekim olacağım.",
           "english_sentence": "I will be a practicing physician after I finish the medical faculty."
        },
        {
           "id": 1171,
           "turkish_word": "kimin",
           "english_word": "whose",
           "type": "pron",
           "turkish_sentence": "Masanın üzerindeki atkı kimin bilmiyorum ama orada bir haftadır duruyor.",
           "english_sentence": "I don't know whose scarf is on the table, but it's been there for a week."
        },
        {
           "id": 1172,
           "turkish_word": "bebek",
           "english_word": "baby",
           "type": "n",
           "turkish_sentence": "Uçakta yolculardan birinin bebeğ i yol boyunca ağladığı için uyuyamadım.",
           "english_sentence": "I couldn't sleep in the plane because the baby of one of the passengers was crying all the way."
        },
        {
           "id": 1173,
           "turkish_word": "alo",
           "english_word": "hello",
           "type": "interj",
           "turkish_sentence": "Alo, beni duyuyor musunuz?",
           "english_sentence": "Hello, can you hear me?"
        },
        {
           "id": 1174,
           "turkish_word": "hayal",
           "english_word": "dream",
           "type": "n",
           "turkish_sentence": "Küçüklük hayal im üç katlı bir evde yaşayıp kedi ve köpek beslemekti hep.",
           "english_sentence": "My childhood dream was always living in a triplex house with cats and dogs."
        },
        {
           "id": 1175,
           "turkish_word": "yaptığını",
           "english_word": "that you did/that you have done",
           "type": "ptcp",
           "turkish_sentence": "Bunu senin yaptığını bilmiyordum.",
           "english_sentence": "I didn't know that you did that."
        },
        {
           "id": 1176,
           "turkish_word": "gidiyoruz",
           "english_word": "we're going",
           "type": "v",
           "turkish_sentence": "Haftaya Uludağ'a kayak yapmaya gidiyoruz, bizimle gelmek ister misin?",
           "english_sentence": "Next week, we're going to Uludağ for skiing, do you want to come with us?"
        },
        {
           "id": 1177,
           "turkish_word": "çalışıyor",
           "english_word": "s/he/it is working",
           "type": "v",
           "turkish_sentence": "Arkadaşım üniversitede okurken aynı zamanda yarı zamanlı olarak bir kafede çalışıyor.",
           "english_sentence": "My friend is working part time in a café while studying in the university at the same time."
        },
        {
           "id": 1178,
           "turkish_word": "kapıyı",
           "english_word": "the door",
           "type": "n",
           "turkish_sentence": "Kapıyı açık bırakma lütfen, içeriye sivrisinek giriyor.",
           "english_sentence": "Please don't leave the door open, mosquitoes come inside."
        },
        {
           "id": 1179,
           "turkish_word": "gelip",
           "english_word": "by coming",
           "type": "ptcp",
           "turkish_sentence": "İkide bir yanıma gelip beni rahatsız etmekten vazgeçecek misin?",
           "english_sentence": "Will you stop bothering me by coming to my side all the time?"
        },
        {
           "id": 1180,
           "turkish_word": "yeni",
           "english_word": "new",
           "type": "adj",
           "turkish_sentence": "Artık yeni bir eve taşınmanın zamanı geldi, bu ev bizim için fazla küçük.",
           "english_sentence": "Now, it's time to move to a new house, this one is too small for us."
        },
        {
           "id": 1181,
           "turkish_word": "muhtemelen",
           "english_word": "probably",
           "type": "adv",
           "turkish_sentence": "Bu akşam muhtemelen yağmur yağacak, dışarı çıkarken şemsiyeni yanına alsan iyi olur.",
           "english_sentence": "Tonight probably it will rain, you had better take your umbrella with you when you're going out."
        },
        {
           "id": 1182,
           "turkish_word": "nasılsın",
           "english_word": "how are you?",
           "type": "interr",
           "turkish_sentence": "Görüşmeyeli uzun zaman oldu, nasılsın ?",
           "english_sentence": "It's been a long time since we saw each other, how are you ?"
        },
        {
           "id": 1183,
           "turkish_word": "çenen",
           "english_word": "your chin",
           "type": "n poss",
           "turkish_sentence": "Çenen i neden beğenmiyorsun anlamıyorum, yüzünle gayet orantılı duruyor.",
           "english_sentence": "I don't understand why you don't like your chin ; it fits very well in your face."
        },
        {
           "id": 1184,
           "turkish_word": "sürü",
           "english_word": "herd",
           "type": "n",
           "turkish_sentence": "Sürü deki koyunlardan iki tanesi hamileydi ama dün gece doğurmuşlar.",
           "english_sentence": "Two of the sheep in the herd were pregnant, but they gave birth last night."
        },
        {
           "id": 1185,
           "turkish_word": "yeterince",
           "english_word": "enough",
           "type": "adj",
           "turkish_sentence": "Bugün yeterince tatlı yedim, daha fazla yememem gerek.",
           "english_sentence": "I ate enough sweets today, I shouldn't eat any more."
        },
        {
           "id": 1186,
           "turkish_word": "evlilik",
           "english_word": "marriage",
           "type": "n",
           "turkish_sentence": "Çocukken, annemle babamın mükemmel bir evlilik yaptığını düşünürdüm.",
           "english_sentence": "I used to think that my parents had the perfect marriage when I was kid."
        },
        {
           "id": 1187,
           "turkish_word": "şaka",
           "english_word": "joke",
           "type": "n",
           "turkish_sentence": "Öğretmenin yaptığı şaka hiç komik değildi, ama tüm sınıf gülüyormuş gibi yaptı.",
           "english_sentence": "The joke that the teacher made was not funny, but the whole class pretended to laugh."
        },
        {
           "id": 1188,
           "turkish_word": "dönerim",
           "english_word": "I will be back",
           "type": "v",
           "turkish_sentence": "Burada bekle, ben birkaç saat içinde dönerim.",
           "english_sentence": "Just wait here, I will be back in a few hours."
        },
        {
           "id": 1189,
           "turkish_word": "haklısın",
           "english_word": "you're right",
           "type": "~",
           "turkish_sentence": "Sen de haklısın, ama bir de onun bakış açısından düşünmeyi dene.",
           "english_sentence": "You're also right but try to think about his point of view."
        },
        {
           "id": 1190,
           "turkish_word": "arkadaşım",
           "english_word": "my friend",
           "type": "n poss",
           "turkish_sentence": "En iyi arkadaşım yarın evleniyor, bu yüzden o gece çok şık olmak istiyorum.",
           "english_sentence": "My best friend is marrying tomorrow, that's why I want to be chic for that night."
        },
        {
           "id": 1191,
           "turkish_word": "acele",
           "english_word": "hurry",
           "type": "n",
           "turkish_sentence": "İşlerini acele halinde yaparsan, işin sonunda pek başarılı bir sonuç elde edemezsin.",
           "english_sentence": "If you do your job in a hurry, at the end you can't get a good result."
        },
        {
           "id": 1192,
           "turkish_word": "durun",
           "english_word": "stop",
           "type": "v",
           "turkish_sentence": "Trafikteyken kırmızı ışıkta her zaman durun lütfen.",
           "english_sentence": "When you are on the road, please stop every time there is a red light."
        },
        {
           "id": 1193,
           "turkish_word": "anladım",
           "english_word": "I understood",
           "type": "v",
           "turkish_sentence": "Matematik öğretmenimin sınıfta çözdüğü soruyu geç de olsa anladım.",
           "english_sentence": "Even though it was late, I understood the solution of the problem that my mathematics teacher solved in the class."
        },
        {
           "id": 1194,
           "turkish_word": "beyler",
           "english_word": "guys",
           "type": "n pl",
           "turkish_sentence": "Beyler, sizi müstakbel nişanlım Aylin ile tanıştırayım.",
           "english_sentence": "Guys, let me introduce you my dear fiancé Aylin."
        },
        {
           "id": 1195,
           "turkish_word": "verin",
           "english_word": "give",
           "type": "v",
           "turkish_sentence": "Bu proje çok fazla iş gerekiyor, bitirmem için bana biraz zaman verin lütfen.",
           "english_sentence": "This project needs a lot of work, please give me some time to finish it."
        },
        {
           "id": 1196,
           "turkish_word": "yolunda",
           "english_word": "going well",
           "type": "adv",
           "turkish_sentence": "Ben tam her şey yolunda gidiyor derken, yeni bir sorun patlak verdi.",
           "english_sentence": "As I was just saying everything was going well, another problem burst out."
        },
        {
           "id": 1197,
           "turkish_word": "şeyleri",
           "english_word": "the things",
           "type": "n pl",
           "turkish_sentence": "Bazı şeyleri görmezden gelmem, önceki yaptıklarını affettiğim anlamına gelmez.",
           "english_sentence": "Just because I ignore some things, it doesn't mean that I forgive you for what you did before."
        },
        {
           "id": 1198,
           "turkish_word": "iyiyim",
           "english_word": "I'm fine",
           "type": "interj",
           "turkish_sentence": "Dün gece sadece iki saat uyumama rağmen şu an iyiyim, sadece biraz yorgun hissediyorum.",
           "english_sentence": "Although I slept only two hours this night, I'm fine ; I just feel a bit tired."
        },
        {
           "id": 1199,
           "turkish_word": "baban",
           "english_word": "your father",
           "type": "n",
           "turkish_sentence": "Normalde seni okuldan baban mı alıyor, yoksa eve kendin mi gidiyorsun?",
           "english_sentence": "Does your father get you from school usually, or do you go back home by yourself?"
        },
        {
           "id": 1200,
           "turkish_word": "bilmek",
           "english_word": "to know",
           "type": "v",
           "turkish_sentence": "Bütün gece dışarıda ne yaptığını bilmiyorum, bilmek de istemiyorum.",
           "english_sentence": "I don't know what he did out all night, and I don't want to know."
        },
        {
           "id": 1201,
           "turkish_word": "birinin",
           "english_word": "somebody's",
           "type": "n",
           "turkish_sentence": "Birinin cüzdanı kafedeki masanın üzerinde kalmış, birisi almadan görevlilere teslim edelim.",
           "english_sentence": "Somebody's wallet was left on the table in the café, let's give it to the staff before someone takes it."
        },
        {
           "id": 1202,
           "turkish_word": "hepsi",
           "english_word": "all of",
           "type": "adv",
           "turkish_sentence": "Buzdolabındaki çikolatalı kekin hepsi ni sen mi yedin?",
           "english_sentence": "Did you eat all of the chocolate cake in the fridge by yourself?"
        },
        {
           "id": 1203,
           "turkish_word": "dans",
           "english_word": "dance",
           "type": "n",
           "turkish_sentence": "Sekiz yaşımdan beri dans okuluna gidiyorum, çünkü dans etmek beni mutlu ediyor.",
           "english_sentence": "I have been going to a dance school since I was eight years old, because dancing makes me happy."
        },
        {
           "id": 1204,
           "turkish_word": "kardeşim",
           "english_word": "my sister/brother",
           "type": "n",
           "turkish_sentence": "Kardeşim asla acılı yemek yiyemez, ama ben yemeyi çok severim.",
           "english_sentence": "My brother can never eat spicy food, but I really like it."
        },
        {
           "id": 1205,
           "turkish_word": "geldin",
           "english_word": "you came",
           "type": "v",
           "turkish_sentence": "Bugünkü partime iyi ki geldin, sen olmasaydın çok sıkıcı olurdu.",
           "english_sentence": "I'm glad that you came to my party today, without you it would be so boring."
        },
        {
           "id": 1206,
           "turkish_word": "kapa",
           "english_word": "shut",
           "type": "v",
           "turkish_sentence": "Evden çıkarken pencereleri kapa lütfen, içeriye hırsız girer yoksa.",
           "english_sentence": "Please shut the windows before going out of the house, or else a thief could come in."
        },
        {
           "id": 1207,
           "turkish_word": "gidiyorsun",
           "english_word": "you're going",
           "type": "v",
           "turkish_sentence": "Yarın memleketine gidiyorsun demek, bu akşam beraber yemek yiyelim o zaman.",
           "english_sentence": "So you're going to your hometown tomorrow; let's eat dinner together, then."
        },
        {
           "id": 1208,
           "turkish_word": "günaydın",
           "english_word": "good morning",
           "type": "interj",
           "turkish_sentence": "Herkese günaydın ! Bugünkü yayınımızda küresel ısınma ile ilgili konuşacağız.",
           "english_sentence": "Good morning everyone! In today's broadcast, we are going to talk about global warming."
        },
        {
           "id": 1209,
           "turkish_word": "yapacağım",
           "english_word": "I will do",
           "type": "v",
           "turkish_sentence": "Son zamanlarda çok sağlıksız besleniyorum, yarından itibaren spor yapacağım.",
           "english_sentence": "I have been eating unhealthy lately, from tomorrow, I will do exercise."
        },
        {
           "id": 1210,
           "turkish_word": "verdim",
           "english_word": "I gave",
           "type": "v",
           "turkish_sentence": "Bugün hayatımda ilk defa bir sınıfta İngilizce dersi verdim.",
           "english_sentence": "Today, I gave an English lesson to a class for the first time in my life."
        },
        {
           "id": 1211,
           "turkish_word": "memnun",
           "english_word": "content",
           "type": "adj",
           "turkish_sentence": "Doğum günü için gittiğimiz restorandaki yemeklerden pek memnun değildi.",
           "english_sentence": "She wasn't content with the food in the restaurant where we went for her birthday."
        },
        {
           "id": 1212,
           "turkish_word": "kızı",
           "english_word": "the daughter",
           "type": "n",
           "turkish_sentence": "Karşı komşunun kızı çok iyi bir üniversiteyi kazanmış.",
           "english_sentence": "The daughter of the opposite neighbor was accepted in a very good university."
        },
        {
           "id": 1213,
           "turkish_word": "olmayacak",
           "english_word": "won't happen",
           "type": "v",
           "turkish_sentence": "Patrondan gelen mesaja göre yarın işyerinde toplantı olmayacak.",
           "english_sentence": "According to the message from the boss, there won't be a meeting in the workplace tomorrow."
        },
        {
           "id": 1214,
           "turkish_word": "geceler",
           "english_word": "nights",
           "type": "n pl",
           "turkish_sentence": "Kışın geceler daha uzun olduğu için günler hızlı geçiyor gibi hissediyorum.",
           "english_sentence": "During winter, I feel like the days pass quickly because the nights are longer."
        },
        {
           "id": 1215,
           "turkish_word": "veriyorum",
           "english_word": "I give",
           "type": "v",
           "turkish_sentence": "On beş yıldır öğretmenlik yapıyorum ve matematik ve fen alanında özel ders veriyorum.",
           "english_sentence": "I've been working as a teacher for fifteen years and I give private lessons of mathematics and science."
        },
        {
           "id": 1216,
           "turkish_word": "yapamam",
           "english_word": "I can't",
           "type": "v",
           "turkish_sentence": "Yemek yapmayı çok sevsem de, tek başıma tiramisu yapamam.",
           "english_sentence": "Although I really love cooking, I can't make tiramisu by myself."
        },
        {
           "id": 1217,
           "turkish_word": "çalışıyoruz",
           "english_word": "we are/have been working",
           "type": "v",
           "turkish_sentence": "10 yıldan uzun bir zamandır aynı fabrikada çalışıyoruz.",
           "english_sentence": "We have been working in the same factory for over 10 years."
        },
        {
           "id": 1218,
           "turkish_word": "sanıyorsun",
           "english_word": "you think",
           "type": "v",
           "turkish_sentence": "Hey sen! Orada ne yaptığını sanıyorsun öyle?",
           "english_sentence": "Hey you! What do you think you're doing over there?"
        },
        {
           "id": 1219,
           "turkish_word": "terk",
           "english_word": "leave/abandon",
           "type": "n",
           "turkish_sentence": "Nükleer saldırı alarmından sonra adada yaşayanların hemen orayı terk etmesi gerektiği söylendi.",
           "english_sentence": "After the nuclear attack alarm, the residents of the island were told to leave there immediately."
        },
        {
           "id": 1220,
           "turkish_word": "neyi",
           "english_word": "what",
           "type": "adv",
           "turkish_sentence": "Yarınki toplantıya gitmek istemiyorum derken neyi kastediyorsun?",
           "english_sentence": "What do you mean by saying you don't want to go to the meeting tomorrow?"
        },
        {
           "id": 1221,
           "turkish_word": "sanıyordum",
           "english_word": "I thought",
           "type": "v",
           "turkish_sentence": "Madrid'den gönderdiğim kargonun bu hafta içinde ulaşacağını sanıyordum\r.",
           "english_sentence": "I thought the cargo I sent would arrive within this week."
        },
        {
           "id": 1222,
           "turkish_word": "sevindim",
           "english_word": "I'm happy/glad",
           "type": "v",
           "turkish_sentence": "Üzerinde aylardır çalıştığın tezinin bir dergide yayınlanacağını duyduğuma çok sevindim.",
           "english_sentence": "I'm so happy to hear that the thesis you've been working on for months will be published in a journal."
        },
        {
           "id": 1223,
           "turkish_word": "kere",
           "english_word": "times",
           "type": "postp",
           "turkish_sentence": "Yumurtaları çırpıp un ve sütü ekledikten sonra sonra karışımı tavaya ekleyip iki kere döndürerek pişirin.",
           "english_sentence": "After you scramble the eggs and add the flour and milk, put the mix in the pan and cook it by spinning it two times."
        },
        {
           "id": 1224,
           "turkish_word": "ölü",
           "english_word": "dead",
           "type": "adj",
           "turkish_sentence": "Bu detoksu haftada üç kere uyguladığınızda, yüzünüzdeki ölü deriden temizlenip daha sağlıklı bir görünüm elde edeceksiniz.",
           "english_sentence": "When you apply this detox three times in a week, you will get rid of the dead skin on your face and have a healthier look."
        },
        {
           "id": 1225,
           "turkish_word": "fikir",
           "english_word": "idea",
           "type": "n",
           "turkish_sentence": "Sanat Tarihi dersimin final projesi için yazmam gereken bir rapor var, bu yüzden de bana fikir vermesi için hocamla görüşeceğim.",
           "english_sentence": "I need to write a report as a final project of my Art History class, that's why I will see my teacher to give me an idea."
        },
        {
           "id": 1226,
           "turkish_word": "tahmin",
           "english_word": "guess",
           "type": "n",
           "turkish_sentence": "Havanın nasıl olacağına dair bir tahmin yapmak çok zor, çünkü son zamanlarda havalar çok değişken.",
           "english_sentence": "It's too hard to make a guess about the weather, because nowadays, the weather is so uncertain."
        },
        {
           "id": 1227,
           "turkish_word": "neydi",
           "english_word": "what was",
           "type": "pron",
           "turkish_sentence": "Aile evinde en son yediğin yemek neydi ?",
           "english_sentence": "What was the last food you ate in your family's house?"
        },
        {
           "id": 1228,
           "turkish_word": "canım",
           "english_word": "honey",
           "type": "interj",
           "turkish_sentence": "Masadaki tuzu bana uzatır mısın, canım ?",
           "english_sentence": "Can you give me the salt on the table, honey ?"
        },
        {
           "id": 1229,
           "turkish_word": "korkunç",
           "english_word": "scary",
           "type": "adj",
           "turkish_sentence": "Cadılar bayramı için korkunç bir vampir kostümü satın aldım.",
           "english_sentence": "I bought a scary vampire costume for halloween."
        },
        {
           "id": 1230,
           "turkish_word": "yaşlı",
           "english_word": "old",
           "type": "adj",
           "turkish_sentence": "Yaşlı adam elindeki poşetlerle karşıdan karşıya geçmeye çalışıyordu.",
           "english_sentence": "The old man was trying to cross the streets with the nylon bags in his hands."
        },
        {
           "id": 1231,
           "turkish_word": "sensin",
           "english_word": "it's you",
           "type": "~",
           "turkish_sentence": "Bu okulda en çok değer verdiğim arkadaşım sensin.",
           "english_sentence": "It's you that I value the most in this school."
        },
        {
           "id": 1232,
           "turkish_word": "hissediyorum",
           "english_word": "I feel",
           "type": "v",
           "turkish_sentence": "İyi bir uyku için her gece duş alıyorum çünkü duştan sonra kendimi iyi hissediyorum.",
           "english_sentence": "I take a shower every night before going to sleep, because after the shower, I feel better."
        },
        {
           "id": 1233,
           "turkish_word": "güle güle",
           "english_word": "goodbye",
           "type": "interj",
           "turkish_sentence": "Güle güle dostum, seni özleyeceğim.",
           "english_sentence": "Goodbye my friend, I will miss you."
        },
        {
           "id": 1234,
           "turkish_word": "olmadı",
           "english_word": "didn't happen",
           "type": "v",
           "turkish_sentence": "Uzmanların tahmininin aksine, bu hafta deprem olmadı.",
           "english_sentence": "Contrary to the estimation of the experts, an earthquake didn't happen this week."
        },
        {
           "id": 1235,
           "turkish_word": "ölüm",
           "english_word": "death",
           "type": "n",
           "turkish_sentence": "Ölüm bütün canlıları bekleyen bir sondur.",
           "english_sentence": "Death is the end that is waiting for every living being."
        },
        {
           "id": 1236,
           "turkish_word": "içeri",
           "english_word": "inside",
           "type": "adv",
           "turkish_sentence": "Dışarısı çok soğuk, içeri gir lütfen.",
           "english_sentence": "Outside is so cold, please get inside."
        },
        {
           "id": 1237,
           "turkish_word": "her şey",
           "english_word": "everything",
           "type": "pron",
           "turkish_sentence": "Son zamanlarda her şey yolunda gidiyor, umarım böyle de devam eder.",
           "english_sentence": "Recently everything is going well, and I hope it continues like this."
        },
        {
           "id": 1238,
           "turkish_word": "sağ ol",
           "english_word": "thanks",
           "type": "interj",
           "turkish_sentence": "Yardımın için sağ ol, artık ödevimi tamamlayabilirim.",
           "english_sentence": "Thanks for your help, now I can finish my homework."
        },
        {
           "id": 1239,
           "turkish_word": "çeviri",
           "english_word": "translation",
           "type": "n",
           "turkish_sentence": "Dün akşam arkadaşım aracılığıyla çeviri işi teklifi aldım.",
           "english_sentence": "Last night I was offered a translation job through my friend."
        },
        {
           "id": 1240,
           "turkish_word": "anladın",
           "english_word": "you understood",
           "type": "v",
           "turkish_sentence": "Edebiyat hocasının bugünkü dersinden ne anladın söyler misin?",
           "english_sentence": "Can you tell me what you understood from the literature teacher's lecture today?"
        },
        {
           "id": 1241,
           "turkish_word": "çık",
           "english_word": "get out",
           "type": "v",
           "turkish_sentence": "Hey sen! Hemen bu dükkandan çık !",
           "english_sentence": "Hey you! Get out of this shop, immediately!"
        },
        {
           "id": 1242,
           "turkish_word": "olurdu",
           "english_word": "would be",
           "type": "v",
           "turkish_sentence": "Bugün bize geleceğini önceden haber verse daha iyi olurdu.",
           "english_sentence": "It would be better if he told me earlier that he would come to our house today."
        },
        {
           "id": 1243,
           "turkish_word": "gelin",
           "english_word": "come",
           "type": "v",
           "turkish_sentence": "Evimin kapısı size her zaman açık, istediğiniz zaman tereddüt etmeden gelin !",
           "english_sentence": "The doors of my house are always open for you, come here any time without hesitating!"
        },
        {
           "id": 1244,
           "turkish_word": "ihtiyacın",
           "english_word": "your need",
           "type": "n poss",
           "turkish_sentence": "Proteine olan ihtiyacın için bol bol yumurta ve et tüketmelisin.",
           "english_sentence": "You need to consume eggs and meat abundantly in order to meet your need for protein."
        },
        {
           "id": 1245,
           "turkish_word": "parayı",
           "english_word": "the money",
           "type": "n",
           "turkish_sentence": "Parayı sonra verseniz de olur, şu an eğlenmeye bakın.",
           "english_sentence": "It is also all right if you give the money later, now try to enjoy the moment."
        },
        {
           "id": 1246,
           "turkish_word": "ihtiyacımız",
           "english_word": "our need",
           "type": "n poss",
           "turkish_sentence": "Ülkece paraya olan ihtiyacımız, uluslararası politik ilişkilerimizde önemli bir rol oynuyor.",
           "english_sentence": "Our need for money as a country plays a big role in our international political relations."
        },
        {
           "id": 1247,
           "turkish_word": "rahatsız",
           "english_word": "uncomfortable",
           "type": "adj",
           "turkish_sentence": "Uçakta on iki saat boyunca rahatsız bir yolculuk geçirdim, bu yüzden de şu an çok yorgunum.",
           "english_sentence": "I had an uncomfortable trip on the plane for twelve hours, that's why now I am so tired."
        },
        {
           "id": 1248,
           "turkish_word": "neyin",
           "english_word": "what",
           "type": "pron",
           "turkish_sentence": "Yarınki tarih sınavında neyin çıkacağını biliyor musun?",
           "english_sentence": "Do you know what will be asked in tomorrow's history exam?"
        },
        {
           "id": 1249,
           "turkish_word": "acı",
           "english_word": "spicy",
           "type": "adj",
           "turkish_sentence": "Kore mutfağı genellikle acı yemeklerden oluşur.",
           "english_sentence": "Korean cuisine generally consists of spicy food."
        },
        {
           "id": 1250,
           "turkish_word": "biliyordum",
           "english_word": "I knew",
           "type": "v",
           "turkish_sentence": "Onun “Dışarıya çıkacak zamanım yok,” derken yalan söylediğini biliyordum.",
           "english_sentence": "I knew that he was lying when he said, “I have no time to go out”."
        },
        {
           "id": 1251,
           "turkish_word": "ediyorsun",
           "english_word": "you are doing",
           "type": "aux",
           "turkish_sentence": "O bize ihanet etti ama sen hala ona yardım ediyorsun.",
           "english_sentence": "He betrayed us but you are still helping him.",
           "notes": "auxilary verb used with nouns"
        },
        {
           "id": 1252,
           "turkish_word": "diyorsun",
           "english_word": "you're saying",
           "type": "v",
           "turkish_sentence": "Masaya oturduğundan beri bana ne diyorsun, anlayamıyorum.",
           "english_sentence": "I can't understand what you're saying to me since you sat at this table."
        },
        {
           "id": 1253,
           "turkish_word": "bırakın",
           "english_word": "leave",
           "type": "v",
           "turkish_sentence": "Siz şimdi yemeğinizi yiyin lütfen, bulaşıkları bana bırakın.",
           "english_sentence": "Please eat your meal now and leave the dishes to me."
        },
        {
           "id": 1254,
           "turkish_word": "çek",
           "english_word": "pull",
           "type": "v",
           "turkish_sentence": "Ateş etmek için ilk önce hedefe odaklan ve sonra tetiği çek.",
           "english_sentence": "To fire a gun, first, focus on your target, and then pull the trigger."
        },
        {
           "id": 1255,
           "turkish_word": "geliyorum",
           "english_word": "I'm coming",
           "type": "v",
           "turkish_sentence": "Yarınki futbol maçını izlemeye ben de geliyorum, az önce biletimi aldım.",
           "english_sentence": "I'm also coming to see the football match tomorrow, I've just bought my ticket."
        },
        {
           "id": 1256,
           "turkish_word": "bizimle",
           "english_word": "with us",
           "type": "prep pron",
           "turkish_sentence": "Pazar günü bizimle birlikte pikniğe gitmek ister misin?",
           "english_sentence": "Do you want to go to picnic with us on Sunday?"
        },
        {
           "id": 1257,
           "turkish_word": "sizinle",
           "english_word": "with you",
           "type": "prep pron",
           "turkish_sentence": "Yarınki Eskişehir gezisine sizinle gelemeyeceğim için üzgünüm.",
           "english_sentence": "I am sorry for not coming to the Eskişehir trip with you tomorrow."
        },
        {
           "id": 1258,
           "turkish_word": "tuhaf",
           "english_word": "weird",
           "type": "adj",
           "turkish_sentence": "Son zamanlardaki davranışların çok tuhaf, bir sorun mu var?",
           "english_sentence": "Recently, your acts are so weird, is there a problem?"
        },
        {
           "id": 1259,
           "turkish_word": "yakında",
           "english_word": "soon",
           "type": "adv",
           "turkish_sentence": "Okuldan beklediğim para yakında hesabıma yatacak, o zamana kadar bekleyin lütfen.",
           "english_sentence": "The money I'm waiting for from the school will be on my account soon, please wait until then."
        },
        {
           "id": 1260,
           "turkish_word": "annen",
           "english_word": "your mom",
           "type": "n poss",
           "turkish_sentence": "Bu kadar yemeğin hepsini annen tek başına mı yaptı gerçekten?",
           "english_sentence": "Did your mom really cook all these foods by herself?"
        },
        {
           "id": 1261,
           "turkish_word": "dön",
           "english_word": "return",
           "type": "v",
           "turkish_sentence": "Saat neredeyse gece yarısı, hemen eve dön lütfen.",
           "english_sentence": "It's almost midnight, please return home immediately."
        },
        {
           "id": 1262,
           "turkish_word": "affedersiniz",
           "english_word": "excuse me",
           "type": "interj",
           "turkish_sentence": "Afedersiniz, vaktiniz varsa anketimi doldurabilir misiniz?",
           "english_sentence": "Excuse me, if you have time, can you fill out my questionnaire?"
        },
        {
           "id": 1263,
           "turkish_word": "Halil",
           "english_word": "Halil",
           "type": "n",
           "turkish_sentence": "Halil fakir bir ailede doğmuştu ama kendi işini kurmayı başardı.",
           "english_sentence": "Halil was born to a poor family but he could manage to set up his own business.",
           "notes": "masculine name"
        },
        {
           "id": 1264,
           "turkish_word": "yemin",
           "english_word": "oath",
           "type": "n",
           "turkish_sentence": "Onunla bir daha konuşmayacağıma dair yemin im var.",
           "english_sentence": "I have sworn an oath that I'm not going to talk to him again."
        },
        {
           "id": 1265,
           "turkish_word": "berbat",
           "english_word": "awful",
           "type": "adj",
           "turkish_sentence": "Dün akşamki yemek berbat tı, ama hiçbir şey söyleyemedim.",
           "english_sentence": "The food from last night was awful, but I couldn't say anything."
        },
        {
           "id": 1266,
           "turkish_word": "dedin",
           "english_word": "you said",
           "type": "v",
           "turkish_sentence": "Bugün derste bana ne dedin, anlayamadım.",
           "english_sentence": "I couldn't understand what you said to me at today's class."
        },
        {
           "id": 1267,
           "turkish_word": "dikkatli",
           "english_word": "careful",
           "type": "adj",
           "turkish_sentence": "Ali dikkatli bir sürücüdür, endişelenmene gerek yok.",
           "english_sentence": "Ali is a careful driver, you don't need to be worried."
        },
        {
           "id": 1268,
           "turkish_word": "siktir",
           "english_word": "f*ck it",
           "type": "interj",
           "turkish_sentence": "Siktir ! Yine otobüsü kaçırdım.",
           "english_sentence": "F*ck it ! I missed the bus again."
        },
        {
           "id": 1269,
           "turkish_word": "Kadir",
           "english_word": "Kadir",
           "type": "n",
           "turkish_sentence": "Kadir İnanır, Türk sinemasının en popüler aktörlerinden biridir.",
           "english_sentence": "Kadir İnanır is one of the most popular actors of Turkish cinema.",
           "notes": "masculine name"
        },
        {
           "id": 1270,
           "turkish_word": "otur",
           "english_word": "sit",
           "type": "v",
           "turkish_sentence": "Lütfen otur, ayakta bekleme.",
           "english_sentence": "Please sit down, don't wait standing."
        },
        {
           "id": 1271,
           "turkish_word": "aşağı",
           "english_word": "down",
           "type": "prep",
           "turkish_sentence": "Asansörle aşağı ineceğim, elimde bir sürü eşya var.",
           "english_sentence": "I will go down by the elevator, I have so much stuff in my hands."
        },
        {
           "id": 1272,
           "turkish_word": "yapacağız",
           "english_word": "we will make",
           "type": "v",
           "turkish_sentence": "İşyerinde küçük bir yılbaşı partisi yapacağız.",
           "english_sentence": "We will make a small Christmas party in our workplace."
        },
        {
           "id": 1273,
           "turkish_word": "burada",
           "english_word": "here",
           "type": "adv",
           "turkish_sentence": "Burada neler oluyor böyle?",
           "english_sentence": "What's going on here ?"
        },
        {
           "id": 1274,
           "turkish_word": "yapacak",
           "english_word": "will make",
           "type": "v",
           "turkish_sentence": "Annem doğum günüm için büyük bir yaş pasta yapacak.",
           "english_sentence": "My mom will make a big cake for my birthday."
        },
        {
           "id": 1275,
           "turkish_word": "dışarıda",
           "english_word": "out",
           "type": "adv",
           "turkish_sentence": "Bugün yemek pişirmek istemiyorum, dışarıda yiyelim.",
           "english_sentence": "I don't want to cook tonight, let's eat out."
        },
        {
           "id": 1276,
           "turkish_word": "yapıyorum",
           "english_word": "I'm doing",
           "type": "v",
           "turkish_sentence": "Seni anlamak için elimden geleni yapıyorum.",
           "english_sentence": "I'm doing my best to understand you."
        },
        {
           "id": 1277,
           "turkish_word": "varmış",
           "english_word": "was/were",
           "type": "v",
           "turkish_sentence": "Arabada yeterince yer varmış, bilseydim ben de gelirdim.",
           "english_sentence": "There were enough spaces in the car, I would've also come if I'd have known."
        },
        {
           "id": 1278,
           "turkish_word": "anlaşıldı",
           "english_word": "was agreed",
           "type": "v",
           "turkish_sentence": "Sonunda ortak bir karar üzerinde anlaşıldı.",
           "english_sentence": "Finally a common decision was agreed upon.",
           "notes": "on/upon"
        },
        {
           "id": 1279,
           "turkish_word": "istedi",
           "english_word": "wanted",
           "type": "v",
           "turkish_sentence": "Bu akşam benimle yemek yemek istedi.",
           "english_sentence": "Tonight she wanted to eat with me."
        },
        {
           "id": 1280,
           "turkish_word": "deli",
           "english_word": "crazy",
           "type": "adj",
           "turkish_sentence": "Dedem gerçekten deli bir adamdı.",
           "english_sentence": "My grandfather was a really crazy man."
        },
        {
           "id": 1281,
           "turkish_word": "yukarı",
           "english_word": "up",
           "type": "prep",
           "turkish_sentence": "Pencereden yukarı baktığımda yıldızları gördüm.",
           "english_sentence": "When I looked up from the window, I saw the stars."
        },
        {
           "id": 1282,
           "turkish_word": "şans",
           "english_word": "luck",
           "type": "n",
           "turkish_sentence": "Ben şans a inanmam, her şeyin bir sebebi vardır.",
           "english_sentence": "I don't believe in luck, everything in life has a reason."
        },
        {
           "id": 1283,
           "turkish_word": "birine",
           "english_word": "to someone",
           "type": "adv",
           "turkish_sentence": "Hayatında hiç birine evlilik teklif ettin mi?",
           "english_sentence": "Have you ever proposed marriage to someone in your life?"
        },
        {
           "id": 1284,
           "turkish_word": "söyledin",
           "english_word": "you said",
           "type": "v",
           "turkish_sentence": "Daha dün dışarı çıkacak vaktin olmadığını söyledin.",
           "english_sentence": "Yesterday you said you had no time to go out."
        },
        {
           "id": 1285,
           "turkish_word": "at",
           "english_word": "horse",
           "type": "n",
           "turkish_sentence": "Daha önce hiç at a binmedim.",
           "english_sentence": "I have never ridden a horse before."
        },
        {
           "id": 1286,
           "turkish_word": "istediğini",
           "english_word": "what you wanted",
           "type": "ptcp",
           "turkish_sentence": "Benden ne istediğini bilirsem sana yardım ederim.",
           "english_sentence": "If I knew what you wanted from me, I would help you."
        },
        {
           "id": 1287,
           "turkish_word": "oradan",
           "english_word": "from there",
           "type": "adv",
           "turkish_sentence": "En iyisi oradan hemen uzaklaş.",
           "english_sentence": "You had better go away from there immediately."
        },
        {
           "id": 1288,
           "turkish_word": "kaptan",
           "english_word": "captain",
           "type": "n",
           "turkish_sentence": "Bu geminin kaptan ı nerede?",
           "english_sentence": "Where is the captain of this ship?"
        },
        {
           "id": 1289,
           "turkish_word": "tatlı",
           "english_word": "sweet",
           "type": "adj",
           "turkish_sentence": "Bu şeftali çok tatlı, bundan güzel bir reçel yapabilirim.",
           "english_sentence": "This peach is so sweet, I can make a good jam from it."
        },
        {
           "id": 1290,
           "turkish_word": "dek",
           "english_word": "till, until",
           "type": "postp",
           "turkish_sentence": "Notlarımı görene dek onlar hakkında düşünmeyeceğim.",
           "english_sentence": "I'm not going to think about my grades till I see them."
        },
        {
           "id": 1291,
           "turkish_word": "uzay",
           "english_word": "space",
           "type": "n",
           "turkish_sentence": "Birçok insan uzay da yaşam olabileceğini düşünüyor.",
           "english_sentence": "Many people think that life might exist in space."
        },
        {
           "id": 1292,
           "turkish_word": "seks",
           "english_word": "sex",
           "type": "n",
           "turkish_sentence": "Çocuklara belli bir yaştan sonra seks eğitimi verilmeli.",
           "english_sentence": "Sex education should be given to the kids after a certain age."
        },
        {
           "id": 1293,
           "turkish_word": "pardon",
           "english_word": "pardon, excuse me",
           "type": "interj",
           "turkish_sentence": "Pardon, yardım eder misiniz? Sipariş vermek istiyorum.",
           "english_sentence": "Excuse me, can you help me? I want to order."
        },
        {
           "id": 1294,
           "turkish_word": "istersen",
           "english_word": "if you want",
           "type": "~",
           "turkish_sentence": "İstersen başka bir kafeye gidebiliriz.",
           "english_sentence": "We can go to another café, if you want."
        },
        {
           "id": 1295,
           "turkish_word": "duydun",
           "english_word": "you heard",
           "type": "v",
           "turkish_sentence": "Beni duydun, hemen buradan ayrıl.",
           "english_sentence": "You heard me, leave here immediately."
        },
        {
           "id": 1296,
           "turkish_word": "bilmem",
           "english_word": "I don't know",
           "type": "v",
           "turkish_sentence": "Şu an ne yapıyor bilmem, kendisine sor.",
           "english_sentence": "I don't know what he's doing now, ask him yourself."
        },
        {
           "id": 1297,
           "turkish_word": "nefes",
           "english_word": "breath",
           "type": "n",
           "turkish_sentence": "Nefes ini tut! Şimdi paraşütle aşağı atlayacağız.",
           "english_sentence": "Hold your breath ! Now, we will jump down with a parachute."
        },
        {
           "id": 1298,
           "turkish_word": "yapar",
           "english_word": "s/he/it does",
           "type": "v",
           "turkish_sentence": "Amcam altmış yaşında olmasına rağmen, her sabah egzersiz yapar.",
           "english_sentence": "Although my uncle is sixty years old, he does exercise every morning."
        },
        {
           "id": 1299,
           "turkish_word": "hata",
           "english_word": "mistake",
           "type": "n",
           "turkish_sentence": "Onu dinlemekle çok büyük bir hata yaptım.",
           "english_sentence": "I made a big mistake by listening to him."
        },
        {
           "id": 1300,
           "turkish_word": "getir",
           "english_word": "bring",
           "type": "v",
           "turkish_sentence": "Mutfağa gelirken bugün aldığın bıçağı da getir.",
           "english_sentence": "When you come to the kitchen, bring the knife you bought today."
        },
        {
           "id": 1301,
           "turkish_word": "ettin",
           "english_word": "you did/performed",
           "type": "aux",
           "turkish_sentence": "Arabayı 2 gün önce tamir ettin ama yine bozuldu.",
           "english_sentence": "You repaired the car 2 days ago, but it broke down again.",
           "notes": "auxilary verb used with nouns"
        },
        {
           "id": 1302,
           "turkish_word": "keşke",
           "english_word": "I wish/if only",
           "type": "interj",
           "turkish_sentence": "Keşke daha önceden söyleseydin, seni beklerdim.",
           "english_sentence": "I wish you had told me before; I would've waited for you."
        },
        {
           "id": 1303,
           "turkish_word": "bununla",
           "english_word": "with this",
           "type": "adv",
           "turkish_sentence": "Bununla ne yapacağımı bilmiyorum.",
           "english_sentence": "I don't know what to do with this."
        },
        {
           "id": 1304,
           "turkish_word": "tut",
           "english_word": "hold",
           "type": "v",
           "turkish_sentence": "Kağıdın ucundan tut ve bana doğru uzat.",
           "english_sentence": "Hold the paper from the end and pass it towards me."
        },
        {
           "id": 1305,
           "turkish_word": "biliyoruz",
           "english_word": "we know",
           "type": "v",
           "turkish_sentence": "Onun ne kadar çalışkan olduğunu biliyoruz.",
           "english_sentence": "We know how clever he is."
        },
        {
           "id": 1306,
           "turkish_word": "inanamıyorum",
           "english_word": "I can't believe",
           "type": "interj",
           "turkish_sentence": "Sınavın bu kadar kısa sürdüğüne inanamıyorum.",
           "english_sentence": "I can't believe that the exam was so short."
        },
        {
           "id": 1307,
           "turkish_word": "koca",
           "english_word": "huge",
           "type": "adj",
           "turkish_sentence": "Evin önüne koca bir kardan adam yaptık.",
           "english_sentence": "We made a huge snowman in front of the house."
        },
        {
           "id": 1308,
           "turkish_word": "ajan",
           "english_word": "spy",
           "type": "n",
           "turkish_sentence": "Ajan olmak çok tehlikeli ve zor bir iş.",
           "english_sentence": "Being a spy is such a dangerous and difficult job."
        },
        {
           "id": 1309,
           "turkish_word": "kahve",
           "english_word": "coffee",
           "type": "n",
           "turkish_sentence": "İki saat ders çalıştıktan sonra şimdi kahve sırası.",
           "english_sentence": "After studying for two hours, now it's time for a coffee break."
        },
        {
           "id": 1310,
           "turkish_word": "benziyor",
           "english_word": "looks like",
           "type": "v",
           "turkish_sentence": "Fotoğraftaki çocuk kuzenime benziyor.",
           "english_sentence": "The kid in the picture looks like my cousin."
        },
        {
           "id": 1311,
           "turkish_word": "neye",
           "english_word": "what",
           "type": "pron",
           "turkish_sentence": "Sonunda neye karar verdin?",
           "english_sentence": "What did you decide on, after all?"
        },
        {
           "id": 1312,
           "turkish_word": "her şeyi",
           "english_word": "everything",
           "type": "adv",
           "turkish_sentence": "Kardeşim benden hiçbir şey saklamaz, bana her şeyi anlatır.",
           "english_sentence": "My sister never hides anything from me, she tells everything."
        },
        {
           "id": 1313,
           "turkish_word": "isterim",
           "english_word": "I want",
           "type": "v",
           "turkish_sentence": "Paris'e gideceksen, oradan bir hediye isterim.",
           "english_sentence": "If you're going to Paris, I want a present from there."
        },
        {
           "id": 1314,
           "turkish_word": "sefer",
           "english_word": "expedition",
           "type": "n",
           "turkish_sentence": "Mesleğim turistler için çeşitli sefer ler düzenlemektir.",
           "english_sentence": "My occupation is organizing various expedition s for tourists."
        },
        {
           "id": 1315,
           "turkish_word": "evine",
           "english_word": "to your home",
           "type": "n",
           "turkish_sentence": "Saat geç oldu, artık evine git.",
           "english_sentence": "It's too late now, go back to your home."
        },
        {
           "id": 1316,
           "turkish_word": "görüyorum",
           "english_word": "I see",
           "type": "v",
           "turkish_sentence": "Görüyorum ki burada eğleniyorsun, yapacak başka bir şeyinin olduğunu unuttun mu?",
           "english_sentence": "I see you're having fun here; did you forget that you had to do something else?"
        },
        {
           "id": 1317,
           "turkish_word": "kızlar",
           "english_word": "girls",
           "type": "n pl",
           "turkish_sentence": "Yarın kızlar arasında küçük bir parti yapmak istiyorum.",
           "english_sentence": "Tomorrow I want to throw a small party between girls."
        },
        {
           "id": 1318,
           "turkish_word": "hayatın",
           "english_word": "your life",
           "type": "n",
           "turkish_sentence": "Eğlence için hayatın ı tehlikeye atma, ekstrem sporlar çok riskli.",
           "english_sentence": "Don't put your life in danger for fun, extreme sports are too risky."
        },
        {
           "id": 1319,
           "turkish_word": "üstüne",
           "english_word": "over",
           "type": "postp",
           "turkish_sentence": "Annem her zaman çocuklarının üstüne titrer.",
           "english_sentence": "My mom always fusses over her children."
        },
        {
           "id": 1320,
           "turkish_word": "insanlar",
           "english_word": "people",
           "type": "n pl",
           "turkish_sentence": "İnsanlar ilk önce duyduklarına inanırlar.",
           "english_sentence": "People first believe in what they hear."
        },
        {
           "id": 1321,
           "turkish_word": "tehlikeli",
           "english_word": "dangerous",
           "type": "adj",
           "turkish_sentence": "Gece vakti tek başına dışarı çıkma, sokaklar çok tehlikeli.",
           "english_sentence": "Don't go out alone during the night, the streets are too dangerous."
        },
        {
           "id": 1322,
           "turkish_word": "dalga",
           "english_word": "wave",
           "type": "n",
           "turkish_sentence": "Güneş altında gözlerimi kapatıp dalga seslerini dinlemek istiyorum.",
           "english_sentence": "I want to close my eyes under the sun and listen to the sound of the waves."
        },
        {
           "id": 1323,
           "turkish_word": "aldın",
           "english_word": "you took",
           "type": "v",
           "turkish_sentence": "Gözlerini annenden aldın, saçlarınsa babaninkilere benziyor.",
           "english_sentence": "You took your eyes from your mother, but your hair looks like your father's."
        },
        {
           "id": 1324,
           "turkish_word": "bayım",
           "english_word": "sir",
           "type": "n",
           "turkish_sentence": "Afedersiniz bayım, biraz beni dinleyebilir misiniz?",
           "english_sentence": "Excuse me sir, can you listen to me for a moment?"
        },
        {
           "id": 1325,
           "turkish_word": "millet",
           "english_word": "nation",
           "type": "n",
           "turkish_sentence": "Kurtuluş Savaşı, Türk Millet i için çok önemli bir savaştır.",
           "english_sentence": "The war of independence is a very important war for the Turkish Nation."
        },
        {
           "id": 1326,
           "turkish_word": "yaşında",
           "english_word": "years old",
           "type": "postp",
           "turkish_sentence": "Henüz on iki yaşında olmasına rağmen, çok iyi piyano ve keman çalabiliyor.",
           "english_sentence": "Although he is twelve years old, he can play piano and violin very well."
        },
        {
           "id": 1327,
           "turkish_word": "ufak",
           "english_word": "small",
           "type": "adj",
           "turkish_sentence": "Pastadan ufak bir dilim alsam yeterli, teşekkür ederim.",
           "english_sentence": "A small slice of cake is enough for me, thank you."
        },
        {
           "id": 1328,
           "turkish_word": "buradayım",
           "english_word": "I'm here",
           "type": "~",
           "turkish_sentence": "Tam iki saattir buradayım, seni bekliyorum.",
           "english_sentence": "I'm here for exactly two hours, waiting for you."
        },
        {
           "id": 1329,
           "turkish_word": "aynen",
           "english_word": "exactly",
           "type": "interj",
           "turkish_sentence": "Dediğimi aynen yapmanı istiyorum, bu yüzden beni iyi dinle.",
           "english_sentence": "I want you to do exactly what I say, so listen to me carefully."
        },
        {
           "id": 1330,
           "turkish_word": "gidin",
           "english_word": "go",
           "type": "v pl",
           "turkish_sentence": "Siz önden gidin lütfen, ben biraz gecikeceğim.",
           "english_sentence": "Please go before me, I will be a bit late."
        },
        {
           "id": 1331,
           "turkish_word": "kör",
           "english_word": "blind",
           "type": "adj",
           "turkish_sentence": "İnsanlar kör adamın yolun karşısına geçmesine yardım ettiler.",
           "english_sentence": "People helped the blind man to cross the road."
        },
        {
           "id": 1332,
           "turkish_word": "olası",
           "english_word": "possible",
           "type": "ptcp",
           "turkish_sentence": "Olası bir deprem ihtimaline karşı evde ilk yardım kiti bulundurunuz.",
           "english_sentence": "Please keep a first aid kit in your home in case of a possible earthquake."
        },
        {
           "id": 1333,
           "turkish_word": "zamandır",
           "english_word": "for a time",
           "type": "postp",
           "turkish_sentence": "Uzun zamandır bu kadar çok eğlenmemiştim.",
           "english_sentence": "I haven’t had this much fun for a long time."
        },
        {
           "id": 1334,
           "turkish_word": "herhalde",
           "english_word": "probably",
           "type": "adv",
           "turkish_sentence": "Yarın herhalde okul tatil olacak çünkü kar şiddetli yağmaya başladı.",
           "english_sentence": "Tomorrow probably the school will be closed for holidays, because it started snowing very hard."
        },
        {
           "id": 1335,
           "turkish_word": "arabada",
           "english_word": "in the car",
           "type": "adv",
           "turkish_sentence": "Hemen döneceğim, sigaramı arabada unutmuşum.",
           "english_sentence": "I will be right back; I forgot my cigarettes in the car."
        },
        {
           "id": 1336,
           "turkish_word": "ahbap",
           "english_word": "friend",
           "type": "n",
           "turkish_sentence": "Bu akşam, ahbap larımla dışarıda yemek yiyeceğim.",
           "english_sentence": "Tonight, I'm going to eat out with my friends."
        },
        {
           "id": 1337,
           "turkish_word": "sessiz",
           "english_word": "quiet",
           "type": "adv",
           "turkish_sentence": "Kütüphane her zaman sessiz olduğu için rahatça ders çalışabilirsin.",
           "english_sentence": "You can study very easily in the library because it's always quiet."
        },
        {
           "id": 1338,
           "turkish_word": "köpek",
           "english_word": "dog",
           "type": "n",
           "turkish_sentence": "Her zaman bir köpek ve bir kedim olsun istemişimdir, ama annem evde evcil hayvan istemiyor.",
           "english_sentence": "I always wanted to own a dog and a cat, but my mother doesn't want a pet in the house."
        },
        {
           "id": 1339,
           "turkish_word": "kahrolası",
           "english_word": "damn",
           "type": "ptcp",
           "turkish_sentence": "Bu kahrolası mahalleden artık ayrılmak istiyorum.",
           "english_sentence": "I want to leave this damn neighborhood."
        },
        {
           "id": 1340,
           "turkish_word": "temiz",
           "english_word": "clean",
           "type": "adj",
           "turkish_sentence": "Temiz havluları resepsiyondan temin edebilirsiniz.",
           "english_sentence": "You can receive the clean towels from reception."
        },
        {
           "id": 1341,
           "turkish_word": "olmalısın",
           "english_word": "you must be",
           "type": "~",
           "turkish_sentence": "Her zaman çok lezzetli yemek yapıyorsun, kesinlikle aşçı olmalısın.",
           "english_sentence": "You always make delicious meals, you must be a cook."
        },
        {
           "id": 1342,
           "turkish_word": "görünüyorsun",
           "english_word": "you look",
           "type": "v",
           "turkish_sentence": "Yorgun görünüyorsun, iş yerinde fazla mesai mi yaptın?",
           "english_sentence": "You look tired, did you work overtime in your workplace?"
        },
        {
           "id": 1343,
           "turkish_word": "arkadaş",
           "english_word": "friend",
           "type": "n",
           "turkish_sentence": "Yurt dışındayken birçok arkadaş edindim, hepsiyle halen görüşmekteyim.",
           "english_sentence": "I had so many friends when I was abroad, I'm still in contact with all of them."
        },
        {
           "id": 1344,
           "turkish_word": "bilmiyor",
           "english_word": "s/he/it doesn't know",
           "type": "v",
           "turkish_sentence": "Beş yıldır tek başına yaşamasına rağmen hâlâ yemek yapmayı bilmiyor.",
           "english_sentence": "He doesn't know how to cook although he's been living alone for five years."
        },
        {
           "id": 1345,
           "turkish_word": "görüyor",
           "english_word": "s/he/it sees",
           "type": "v",
           "turkish_sentence": "Küçük kardeşim babamı rol model olarak görüyor.",
           "english_sentence": "My little brother sees my father as a role model."
        },
        {
           "id": 1346,
           "turkish_word": "anlamıyorum",
           "english_word": "I don't understand",
           "type": "v",
           "turkish_sentence": "Bazen tarih hocamın derste neden bahsettiğini anlamıyorum, ancak ders notlarını okuyarak anlayabiliyorum.",
           "english_sentence": "Sometimes I don't understand what my history teacher is talking about, I can only understand from the lecture notes."
        },
        {
           "id": 1347,
           "turkish_word": "hoşça",
           "english_word": "nicely",
           "type": "adv",
           "turkish_sentence": "Dün öğleden sonra gittiğim kafe hoşça tasarlanmıştı ve kahvesi çok kaliteliydi.",
           "english_sentence": "The café I went to yesterday afternoon was nicely decorated and the coffee was delicious."
        },
        {
           "id": 1348,
           "turkish_word": "vakit",
           "english_word": "time",
           "type": "n",
           "turkish_sentence": "Ceren ile birlikteyken her zaman çok iyi vakit geciriyorum.",
           "english_sentence": "When I am with Ceren, I always have very good time."
        },
        {
           "id": 1349,
           "turkish_word": "yapmam",
           "english_word": "I don't",
           "type": "v",
           "turkish_sentence": "Genellikle yemek yapmam, ama yapmak istersem çok lezzetli bir öğün hazırlayabilirim.",
           "english_sentence": "Usually I don't cook, but when I want to do it, I can prepare a very tasty meal."
        },
        {
           "id": 1350,
           "turkish_word": "söylüyorum",
           "english_word": "I'm telling",
           "type": "v",
           "turkish_sentence": "Sana doğruyu söylüyorum, bana inan lütfen.",
           "english_sentence": "I'm telling you the truth, please believe me."
        },
        {
           "id": 1351,
           "turkish_word": "yedi",
           "english_word": "seven",
           "type": "num",
           "turkish_sentence": "Çocuğum yarın yedi yaşına girecek, zaman ne kadar da çabuk geçiyor.",
           "english_sentence": "My child will be seven years old tomorrow, time goes so fast."
        },
        {
           "id": 1352,
           "turkish_word": "olacaksın",
           "english_word": "you will be",
           "type": "v",
           "turkish_sentence": "Sen de bir gün anne olacaksın, o zaman beni anlarsın.",
           "english_sentence": "You will also be a mother one day, then you will understand me."
        },
        {
           "id": 1353,
           "turkish_word": "düşünüyor",
           "english_word": "",
           "type": "v",
           "turkish_sentence": "Erkek arkadaşım başka bir şehre taşınmayı düşünüyor.",
           "english_sentence": "My boyfriend thinks about moving to another city.",
           "notes": "she/he/it"
        },
        {
           "id": 1354,
           "turkish_word": "söylemiştim",
           "english_word": "I told",
           "type": "v",
           "turkish_sentence": "O bankaya güvenmemen gerektiğini sana söylemiştim, şimdi kaybettiğin paralara ne olacak?",
           "english_sentence": "I told you not to trust that bank, now what's going to happen to the money you lost?"
        },
        {
           "id": 1355,
           "turkish_word": "doğum",
           "english_word": "birth",
           "type": "n",
           "turkish_sentence": "Doğum tarihinizi girdikten sonra sisteme kaydolabilirsiniz.",
           "english_sentence": "You can sign up to the system after you enter your birth date."
        },
        {
           "id": 1356,
           "turkish_word": "olduğun",
           "english_word": "be",
           "type": "ptcp",
           "turkish_sentence": "İlk kez aşık olduğun kişiyi hatırlıyor musun?",
           "english_sentence": "Do you remember the person whom you were first in love with?"
        },
        {
           "id": 1357,
           "turkish_word": "yapacaksın",
           "english_word": "you will do",
           "type": "v",
           "turkish_sentence": "Mezun olduktan sonra ne yapacaksın, hiç düşündün mü?",
           "english_sentence": "Have you ever thought about what you will do after you graduate?"
        },
        {
           "id": 1358,
           "turkish_word": "diyorum",
           "english_word": "I'm saying",
           "type": "v",
           "turkish_sentence": "Diyorum ki, hepimiz bir miktar para verip hocamıza doğum günü hediyesi alabiliriz.",
           "english_sentence": "What I'm saying is we can give a certain amount of money and buy a birthday present for our teacher."
        },
        {
           "id": 1359,
           "turkish_word": "düşman",
           "english_word": "enemy",
           "type": "n",
           "turkish_sentence": "Düşman birlikleri saldırıyor! Siper alın!",
           "english_sentence": "Enemy troops are attacking! Take cover!"
        },
        {
           "id": 1360,
           "turkish_word": "düşün",
           "english_word": "think",
           "type": "v",
           "turkish_sentence": "Bir de anneni düşün, seni ne kadar çok özlemiştir kim bilir.",
           "english_sentence": "Think about your mother, who knows how much she missed you."
        },
        {
           "id": 1361,
           "turkish_word": "buldun",
           "english_word": "you found",
           "type": "v",
           "turkish_sentence": "Ne yapıp edip istediğin renkte çantayı buldun, tebrikler.",
           "english_sentence": "Somehow you found the bag with the color you wanted, congratulations."
        },
        {
           "id": 1362,
           "turkish_word": "alın",
           "english_word": "forehead",
           "type": "n",
           "turkish_sentence": "Alın da oluşan çizgilerden nasıl kurtulabilirim?",
           "english_sentence": "How can I get rid of the forehead lines?"
        },
        {
           "id": 1363,
           "turkish_word": "acil",
           "english_word": "emergency",
           "type": "adj",
           "turkish_sentence": "Yangın durumunda acil çıkış kapısını kullanınız.",
           "english_sentence": "In case of a fire please use the emergency door."
        },
        {
           "id": 1364,
           "turkish_word": "istediğin",
           "english_word": "whenever",
           "type": "ptcp",
           "turkish_sentence": "Yardıma ihtiyacın olduğunda istediğin zaman beni arayabilirsin.",
           "english_sentence": "When you need help, you can call me whenever you want."
        },
        {
           "id": 1365,
           "turkish_word": "bilemiyorum",
           "english_word": "I don't know",
           "type": "~",
           "turkish_sentence": "Bu yağmurlu havada dışarıda ne yapabiliriz, bilemiyorum.",
           "english_sentence": "I don't know what we can do in this rainy weather."
        },
        {
           "id": 1366,
           "turkish_word": "kızım",
           "english_word": "my daughter",
           "type": "n poss",
           "turkish_sentence": "Kızım İngiltere'de master programına başladı.",
           "english_sentence": "My daughter started a master’s program in England."
        },
        {
           "id": 1367,
           "turkish_word": "haklı",
           "english_word": "right",
           "type": "adv",
           "turkish_sentence": "Restoran sahibiyle yaptığınız tartışmada sizin haklı olduğunuzu düşünüyorum.",
           "english_sentence": "I think you were right on the discussion with the restaurant owner."
        },
        {
           "id": 1368,
           "turkish_word": "kimsenin",
           "english_word": "nobody's",
           "type": "pron poss",
           "turkish_sentence": "Kimsenin zevkini eleştirmiyorum, ama metal müzikten hiç hoşlanmıyorum.",
           "english_sentence": "I don't criticize anybody's taste, but I don't like metal music at all."
        },
        {
           "id": 1369,
           "turkish_word": "sesini",
           "english_word": "",
           "type": "n",
           "turkish_sentence": "Arkadaşımın sesini nerede duysam tanırım.",
           "english_sentence": "I can recognize my friend's voice wherever I hear it.",
           "notes": "somebody's"
        },
        {
           "id": 1370,
           "turkish_word": "olsaydı",
           "english_word": "if",
           "type": "conj",
           "turkish_sentence": "Yeterli param olsaydı, Burberry marka bir çanta almak isterdim.",
           "english_sentence": "If I had enough money, I would buy a Burberry brand bag."
        },
        {
           "id": 1371,
           "turkish_word": "bulmak",
           "english_word": "to find",
           "type": "v",
           "turkish_sentence": "Yeni bir ortamda arkadaş bulmak başta çok zor.",
           "english_sentence": "It's too hard to find a friend in a new environment, at first."
        },
        {
           "id": 1372,
           "turkish_word": "tıpkı",
           "english_word": "exactly like",
           "type": "adj",
           "turkish_sentence": "Sınıfımdaki bir öğrenci tıpkı sana benziyordu!",
           "english_sentence": "A student in my class looked exactly like you!"
        },
        {
           "id": 1373,
           "turkish_word": "gitmem",
           "english_word": "I don't go",
           "type": "v",
           "turkish_sentence": "Genellikle içkili mekanlara gitmem.",
           "english_sentence": "I usually don't go to the places with alcohol."
        },
        {
           "id": 1374,
           "turkish_word": "uyuşturucu",
           "english_word": "drugs",
           "type": "n",
           "turkish_sentence": "Çocuk yaşta uyuşturucu kullanımı ve satımı ülkemizin ciddi bir sorunudur.",
           "english_sentence": "Using and selling drugs at a young age is a serious problem of our country."
        },
        {
           "id": 1375,
           "turkish_word": "şüpheli",
           "english_word": "suspicious, suspect",
           "type": "adj",
           "turkish_sentence": "Senin ismin de şüpheli ler listesinde, o yüzden dikkatli ol.",
           "english_sentence": "Your name is also on the list of suspects, so be careful."
        },
        {
           "id": 1376,
           "turkish_word": "işler",
           "english_word": "works",
           "type": "n pl",
           "turkish_sentence": "Son zamanlarda işler nasıl gidiyor?",
           "english_sentence": "How are the works going lately?"
        },
        {
           "id": 1377,
           "turkish_word": "çekil",
           "english_word": "get away",
           "type": "v",
           "turkish_sentence": "Yolumdan çekil, yoksa sana çarpabilirim!",
           "english_sentence": "Get away from me, or I can bump into you!"
        },
        {
           "id": 1378,
           "turkish_word": "olduğum",
           "english_word": "I was",
           "type": "ptcp",
           "turkish_sentence": "Üyesi olduğum dernekten başkanlık teklifi aldım.",
           "english_sentence": "I was offered to be the president of the association of which I was a member."
        },
        {
           "id": 1379,
           "turkish_word": "bilmiyordum",
           "english_word": "I didn't know",
           "type": "v",
           "turkish_sentence": "Senin de aynı işe başvurduğunu bilmiyordum.",
           "english_sentence": "I didn't know that you also applied for the same job."
        },
        {
           "id": 1380,
           "turkish_word": "numara",
           "english_word": "number",
           "type": "n",
           "turkish_sentence": "İletişime geçmek için beni bu numara dan arayabilirsiniz.",
           "english_sentence": "You can call me at this number to be in contact."
        },
        {
           "id": 1381,
           "turkish_word": "üstünde",
           "english_word": "above",
           "type": "adv",
           "turkish_sentence": "Notlarım ortalamanın üstünde olsun yeterli.",
           "english_sentence": "It's enough if my grades are above the average."
        },
        {
           "id": 1382,
           "turkish_word": "bilir",
           "english_word": "",
           "type": "v",
           "turkish_sentence": "Kim bilir ne zaman geri dönecek.",
           "english_sentence": "Who knows when she will be back.",
           "notes": "he/she/it"
        },
        {
           "id": 1383,
           "turkish_word": "orospu",
           "english_word": "prostitute",
           "type": "n",
           "turkish_sentence": "Gece yarısından sonra bu sokakta birçok orospu görebilirsiniz.",
           "english_sentence": "You can see many prostitutes in this street after midnight."
        },
        {
           "id": 1384,
           "turkish_word": "edeceğim",
           "english_word": "I will do / I am going to do",
           "type": "aux",
           "turkish_sentence": "Ne olursa olsun ben seni desteklemeye devam edeceğim.",
           "english_sentence": "I will continue to support you, no matter what.",
           "notes": "auxilary verb used with nouns"
        },
        {
           "id": 1385,
           "turkish_word": "arkadaşın",
           "english_word": "your friend",
           "type": "n",
           "turkish_sentence": "Yarınki partiye arkadaşın da gelebilir, ancak kendisinden sen sorumlu olursun.",
           "english_sentence": "Your friend can also come to tomorrow's party, but you will be responsible for him."
        },
        {
           "id": 1386,
           "turkish_word": "alabilir",
           "english_word": "can take",
           "type": "v",
           "turkish_sentence": "İş çıkışı seni babam alabilir, saat kaçta çıkacaksın?",
           "english_sentence": "My father can take you after work, at what time will you leave?"
        },
        {
           "id": 1387,
           "turkish_word": "hatırlıyor",
           "english_word": "",
           "type": "v",
           "turkish_sentence": "Aradan on beş yıl geçmesine rağmen o olayı hatırlıyor.",
           "english_sentence": "He remembers that incident even though it was fifteen years ago.",
           "notes": "he/she/it"
        },
        {
           "id": 1388,
           "turkish_word": "bakma",
           "english_word": "don't look",
           "type": "v",
           "turkish_sentence": "Sakın içeriye bakma ! Sana sürpriz olacak!",
           "english_sentence": "Don't look inside! It will be a surprise for you!"
        },
        {
           "id": 1389,
           "turkish_word": "almak",
           "english_word": "to take",
           "type": "adv",
           "turkish_sentence": "Okula kardeşimi alma ya gidiyorum, gelirken bir şey almamı ister misin?",
           "english_sentence": "I'm going to to take my little sister to school, do you want me to buy something while I’m out?"
        },
        {
           "id": 1390,
           "turkish_word": "gerçeği",
           "english_word": "the reality",
           "type": "n",
           "turkish_sentence": "Hep bir bahane buluyorsun, bu gerçeği ne zaman kabulleneceksin?",
           "english_sentence": "You're always finding an excuse, when will you accept this reality ?"
        },
        {
           "id": 1391,
           "turkish_word": "cinayet",
           "english_word": "murder",
           "type": "n",
           "turkish_sentence": "Televizyondaki cinayet haberi cok korkutucu ve sarsıcıydı.",
           "english_sentence": "The murder news on the TV was so frightening and devastating."
        },
        {
           "id": 1392,
           "turkish_word": "yaparım",
           "english_word": "I do",
           "type": "v",
           "turkish_sentence": "Her sabah kahvaltıdan önce bir saat spor yaparım.",
           "english_sentence": "Every morning before breakfast, I do sports."
        },
        {
           "id": 1393,
           "turkish_word": "kızın",
           "english_word": "the girl's",
           "type": "n poss",
           "turkish_sentence": "Kızın çantası açık kalmış, uyarsak iyi olur.",
           "english_sentence": "The girl's bag was left open, we had better warn her."
        },
        {
           "id": 1394,
           "turkish_word": "muhteşem",
           "english_word": "great",
           "type": "adj",
           "turkish_sentence": "Dün gece izlediğimiz film muhteşem di, sana da öneririm.",
           "english_sentence": "The movie we watched yesterday was great, I recommend that you watch it too."
        },
        {
           "id": 1395,
           "turkish_word": "çirkin",
           "english_word": "ugly",
           "type": "adj",
           "turkish_sentence": "Herkes bu aktrisi seviyor ama bence o çok çirkin.",
           "english_sentence": "Everyone loves this actress, but I think she is quite ugly."
        },
        {
           "id": 1396,
           "turkish_word": "öldürmek",
           "english_word": "to kill",
           "type": "v",
           "turkish_sentence": "Bu ormanda av mevsimi dışında hayvan öldürmek yasaktır.",
           "english_sentence": "It is forbidden to kill animals in this forest, except in the hunting season."
        },
        {
           "id": 1397,
           "turkish_word": "oda",
           "english_word": "room",
           "type": "n",
           "turkish_sentence": "Kardeşimle aynı oda da kalmak istemiyorum, ayrı bir odaya çıkmak istiyorum.",
           "english_sentence": "I don't want to live in the same room with my brother, I want to move to another room."
        },
        {
           "id": 1398,
           "turkish_word": "kırmızı",
           "english_word": "red",
           "type": "adj",
           "turkish_sentence": "Evin önünde kırmızı bir araba var, kim geldi acaba?",
           "english_sentence": "There is a red car in front of the house, I wonder who has come."
        },
        {
           "id": 1399,
           "turkish_word": "söyleme",
           "english_word": "don't say",
           "type": "v",
           "turkish_sentence": "Öyle söyleme, senin için yaptıklarını düşün önce.",
           "english_sentence": "Don't say that, first, think about the things he has done for you."
        },
        {
           "id": 1400,
           "turkish_word": "gelmiş",
           "english_word": "came",
           "type": "v",
           "turkish_sentence": "Arkadaşım otobüsü kaçırdığı için buraya yürüyerek gelmiş.",
           "english_sentence": "My friend came here by walking because she missed the bus."
        },
        {
           "id": 1401,
           "turkish_word": "kimsin",
           "english_word": "who are you",
           "type": "~",
           "turkish_sentence": "Hey! Seni ilk kez burada görüyorum, kimsin ? ",
           "english_sentence": "Hey, it's my first time seeing you here, who are you ? "
        },
        {
           "id": 1402,
           "turkish_word": "evi",
           "english_word": "the house",
           "type": "n",
           "turkish_sentence": "Bu evi çok seviyorum, içinde çok güzel anılarım oldu; ama artık daha büyük bir eve taşınmanın zamanı geldi.",
           "english_sentence": "I love this house very much, I've had very good memories here; but now it's time to move to a bigger house."
        },
        {
           "id": 1403,
           "turkish_word": "pislik",
           "english_word": "dirt",
           "type": "n",
           "turkish_sentence": "Restoranın mutfağı pislik dolu, burada asla yemek yemem.",
           "english_sentence": "The kitchen of the restaurant is full of dirt, I will never eat here."
        },
        {
           "id": 1404,
           "turkish_word": "bahsediyorsun",
           "english_word": "you're talking",
           "type": "v",
           "turkish_sentence": "Deminden beri neden bahsediyorsun bilmiyorum, ama bence biraz sakinleşmeye ihtiyacın var.",
           "english_sentence": "I don't know what you're talking about for all this time, but I think you need to calm down."
        },
        {
           "id": 1405,
           "turkish_word": "kalk",
           "english_word": "stand up",
           "type": "v",
           "turkish_sentence": "Öğretmen sınıfa geldiği zaman ayağa kalk, bu bir saygı göstergesidir.",
           "english_sentence": "Stand up when the teacher comes to the class, this is an indication of showing respect."
        },
        {
           "id": 1406,
           "turkish_word": "sıkı",
           "english_word": "strict",
           "type": "adj",
           "turkish_sentence": "Yeni patron işyerinde sıkı kurallar uygulamak istiyor.",
           "english_sentence": "The new boss wants to apply strict rules for the workplace."
        },
        {
           "id": 1407,
           "turkish_word": "bekliyor",
           "english_word": "waiting",
           "type": "v",
           "turkish_sentence": "Çabuk olmalıyız, taksi yirmi dakikadır dışarıda bizi bekliyor.",
           "english_sentence": "We should hurry, the taxi has been waiting for us for twenty minutes."
        },
        {
           "id": 1408,
           "turkish_word": "işe",
           "english_word": "to work",
           "type": "n",
           "turkish_sentence": "Bu aralar pazar günleri de işe gitmek zorundayım.",
           "english_sentence": "Nowadays, I have to go to work on Sundays, too."
        },
        {
           "id": 1409,
           "turkish_word": "unutma",
           "english_word": "don't forget",
           "type": "v",
           "turkish_sentence": "Okula gelirken ödevini yanında getirmeyi unutma, öğretmen bu konuda çok katı.",
           "english_sentence": "Don't forget to bring your homework with you while coming to the school, the teacher is so strict about this."
        },
        {
           "id": 1410,
           "turkish_word": "buradaki",
           "english_word": "here",
           "type": "adj",
           "turkish_sentence": "Buradaki hayatım çok eğlenceli geçiyor, bu yüzden okula geri dönmek istemiyorum.",
           "english_sentence": "My life here is so much fun; that's why I don't want to go back to school."
        },
        {
           "id": 1411,
           "turkish_word": "işim",
           "english_word": "my job",
           "type": "n",
           "turkish_sentence": "Müşterilerimin şikayetlerini dinlemek ve onlara yardımcı olmak benim işim\r.",
           "english_sentence": "Listening to my customer’s complaints and helping them is my job."
        },
        {
           "id": 1412,
           "turkish_word": "mesaj",
           "english_word": "message",
           "type": "n",
           "turkish_sentence": "Müsait olduğun zaman bana mesaj gönder, bir şeyler yapalım.",
           "english_sentence": "Send me a message when you're available, we can do something."
        },
        {
           "id": 1413,
           "turkish_word": "zavallı",
           "english_word": "poor",
           "type": "adj",
           "turkish_sentence": "Zavallı kedicik, yağmur altında ıslanıyor, gidecek bir yuvası yok sanırım.",
           "english_sentence": "Poor kitty, it's getting wet in the rain, I guess it doesn't have a home to go to."
        },
        {
           "id": 1414,
           "turkish_word": "fena",
           "english_word": "awful",
           "type": "adv",
           "turkish_sentence": "Sorumluluklarını yerine getirmezsen sonuçları çok fena olur.",
           "english_sentence": "If you don't fulfill your responsibilities, the consequences will be awful."
        },
        {
           "id": 1415,
           "turkish_word": "güvenli",
           "english_word": "safe",
           "type": "adj",
           "turkish_sentence": "Burası güvenli bir mahalle, çocuklu aileler burada rahatlıkla ve güvenle yaşayabilir.",
           "english_sentence": "Here is a safe neighborhood, families with children can live here comfortably and safely."
        },
        {
           "id": 1416,
           "turkish_word": "istiyorsan",
           "english_word": "if you want",
           "type": "~",
           "turkish_sentence": "İllaki bana yardım etmek istiyorsan, şuradaki soğanları doğrayıp tavada kavurabilirsin.",
           "english_sentence": "If you really want to help me, you can cut the onions over there and fry them in the pan."
        },
        {
           "id": 1417,
           "turkish_word": "kimseye",
           "english_word": "to anyone",
           "type": "adv",
           "turkish_sentence": "Ecem, kimseye zararı olmayan, sessiz ve sakin bir kızdır.",
           "english_sentence": "Ecem is a calm and quiet girl who has done no harm to anyone."
        },
        {
           "id": 1418,
           "turkish_word": "yürü",
           "english_word": "walk",
           "type": "v",
           "turkish_sentence": "Sağlıklı kilo vermek istiyorsan, yediklerine dikkat et ve bol bol yürü.",
           "english_sentence": "If you want to lose weight healthily, watch out what you eat and walk a lot."
        },
        {
           "id": 1419,
           "turkish_word": "anlat",
           "english_word": "tell",
           "type": "v",
           "turkish_sentence": "Görüşmeyeli uzun zaman oldu, bana şimdiye kadar neler yaptığını anlat.",
           "english_sentence": "It's been a long time since I last saw you; tell me what you did until now."
        },
        {
           "id": 1420,
           "turkish_word": "söylüyorsun",
           "english_word": "you're saying",
           "type": "v",
           "turkish_sentence": "Bana neler söylüyorsun, farkında mısın?",
           "english_sentence": "Are you aware of what you're saying to me?"
        },
        {
           "id": 1421,
           "turkish_word": "biriyle",
           "english_word": "with someone",
           "type": "adv",
           "turkish_sentence": "Dün akşam Mehmet'i biriyle birlikte bir restoranda gördüm.",
           "english_sentence": "Last night, I saw Mehmet with someone in a restaurant."
        },
        {
           "id": 1422,
           "turkish_word": "şarkı",
           "english_word": "song",
           "type": "n",
           "turkish_sentence": "Bana yolda dinlemem için birkaç şarkı önerir misin?",
           "english_sentence": "Can you give me some song recommendations to listen to on the road?"
        },
        {
           "id": 1423,
           "turkish_word": "konuşma",
           "english_word": "speech",
           "type": "n",
           "turkish_sentence": "Yarın yüz kişinin önünde bir konuşma yapmak zorundayım, çok gergin hissediyorum.",
           "english_sentence": "Tomorrow, I have to give a speech in front of one hundred people; I feel very nervous."
        },
        {
           "id": 1424,
           "turkish_word": "içki",
           "english_word": "alcohol",
           "type": "n",
           "turkish_sentence": "On sekiz yaşından küçüklerin içki içmesi tehlikeli ve yasaktır.",
           "english_sentence": "It is dangerous and forbidden for people under eighteen to drink alcohol."
        },
        {
           "id": 1425,
           "turkish_word": "işi",
           "english_word": "his/her job",
           "type": "n",
           "turkish_sentence": "Babam işi ni sevmiyor; bu yüzden işi bırakmayı düşünüyor.",
           "english_sentence": "My father doesn’t like his job ; that’s why he is planning to quit."
        },
        {
           "id": 1426,
           "turkish_word": "bir şeyler",
           "english_word": "something",
           "type": "pron",
           "turkish_sentence": "Bu bilgisayarda bir şeyler yolunda gitmiyor, ama sorun nedir tam olarak bilmiyorum.",
           "english_sentence": "Something is wrong with this computer, but I don't know the exact problem."
        },
        {
           "id": 1427,
           "turkish_word": "Davut",
           "english_word": "Davut/David",
           "type": "n",
           "turkish_sentence": "Davut, matematiği iyi olmadığı için, fizik okumak istemiyor.",
           "english_sentence": "Davut doesn’t want to study physics as he is bad at math.",
           "notes": "masculine name"
        },
        {
           "id": 1428,
           "turkish_word": "ilaç",
           "english_word": "medicine",
           "type": "n",
           "turkish_sentence": "Gönüllü bir grup, savaş mağdurlarına yiyecek ve ilaç sağlıyor.",
           "english_sentence": "A volunteer group provides war victims with food and medicine."
        },
        {
           "id": 1429,
           "turkish_word": "kedi",
           "english_word": "cat",
           "type": "n",
           "turkish_sentence": "İstanbul birçok sokak kedi sine ev sahipliği yapar, Catstanbul denilmesinin sebebi budur.",
           "english_sentence": "Istanbul is home to thousands of stray cats, that’s why it is referred to as Catstanbul."
        },
        {
           "id": 1430,
           "turkish_word": "onlardan",
           "english_word": "from them",
           "type": "adv",
           "turkish_sentence": "Onlardan aldığın bilgileri bize de söyleyecek misin?",
           "english_sentence": "Will you tell me the information you received from them ?"
        },
        {
           "id": 1431,
           "turkish_word": "sonu",
           "english_word": "the end of",
           "type": "n",
           "turkish_sentence": "Oyunun sonu na geldik, kazananı bu son düello belirleyecek.",
           "english_sentence": "We are now at the end of this game; the winner will be determined by this last duel."
        },
        {
           "id": 1432,
           "turkish_word": "zamanlar",
           "english_word": "times",
           "type": "adv pl",
           "turkish_sentence": "O zamanlar cep telefonu kullanmak yaygın değildi, mesajlaşmak da yoktu.",
           "english_sentence": "In those times using cellphones weren't common, and there was no such thing as messaging."
        },
        {
           "id": 1433,
           "turkish_word": "saçma",
           "english_word": "ridiculous",
           "type": "adj",
           "turkish_sentence": "Bazı moda akımları bazen çok saçma tasarımları da barındırabiliyor.",
           "english_sentence": "Some fashion trends can have ridiculous designs."
        },
        {
           "id": 1434,
           "turkish_word": "adamlar",
           "english_word": "men",
           "type": "n pl",
           "turkish_sentence": "Okulun önünde bir sürü takım elbiseli adamlar var, neler oluyor?",
           "english_sentence": "There are so many men wearing suits, what's going on?"
        },
        {
           "id": 1435,
           "turkish_word": "yanına",
           "english_word": "next to",
           "type": "postp",
           "turkish_sentence": "Eşyalarını çalışma masasının yanına bırakabilirsin.",
           "english_sentence": "You can leave your belongings next to the desk."
        },
        {
           "id": 1436,
           "turkish_word": "geldik",
           "english_word": "we came",
           "type": "v",
           "turkish_sentence": "Dışarıdan eve saat on iki civarı geldik.",
           "english_sentence": "We came back home from being out at around twelve o'clock."
        },
        {
           "id": 1437,
           "turkish_word": "anlamı",
           "english_word": "meaning of",
           "type": "n",
           "turkish_sentence": "Bu Türkçe kelimenin anlamı içeriğe göre değişebilir.",
           "english_sentence": "The meaning of this Turkish word can change according to the context."
        },
        {
           "id": 1438,
           "turkish_word": "parçası",
           "english_word": "piece of",
           "type": "n",
           "turkish_sentence": "Yüzüğün üzerinde küçük bir altın parçası var.",
           "english_sentence": "There is a small piece of gold on the ring."
        },
        {
           "id": 1439,
           "turkish_word": "olduğundan",
           "english_word": "as/since/because of",
           "type": "conj",
           "turkish_sentence": "İnternet bugün yavaş olduğundan, mailine geç cevap vermek zorunda kaldım.",
           "english_sentence": "I have to answer your email late, as the internet connection was very slow today."
        },
        {
           "id": 1440,
           "turkish_word": "bulduk",
           "english_word": "we found",
           "type": "v",
           "turkish_sentence": "Trende kaybettiğiniz cüzdanınızı bulduk, istasyona gelip alabilirsiniz.",
           "english_sentence": "We found the wallet you lost in the train, you can take it from the station."
        },
        {
           "id": 1441,
           "turkish_word": "silahı",
           "english_word": "the gun",
           "type": "n",
           "turkish_sentence": "Silahı kullanmadan önce iyice temizlemen gerek.",
           "english_sentence": "You need to clean the gun very well before using it."
        },
        {
           "id": 1442,
           "turkish_word": "yapabilirim",
           "english_word": "I can make",
           "type": "v",
           "turkish_sentence": "Bu akşam için yemekte lazanya yapabilirim, saat kaçta evde olursun?",
           "english_sentence": "I can make lasagna for dinner tonight, at what time will you be at home?"
        },
        {
           "id": 1443,
           "turkish_word": "yapalım",
           "english_word": "let's do",
           "type": "v",
           "turkish_sentence": "Haydi hep beraber spor yapalım, bugün çok fazla yemek yedik.",
           "english_sentence": "Let's do sports together, we ate a lot today."
        },
        {
           "id": 1444,
           "turkish_word": "bayanlar",
           "english_word": "women",
           "type": "n pl",
           "turkish_sentence": "Bu yüzme havuzu sadece bayanlar a özel, karma bir havuz için şu adrese gidebilirsiniz.",
           "english_sentence": "This swimming pool is for women only, you can go to this address for a mixed pool."
        },
        {
           "id": 1445,
           "turkish_word": "alacağım",
           "english_word": "I'll take/I’ll get",
           "type": "v",
           "turkish_sentence": "Beni biraz bekle, on dakika içinde seni evin önünden alacağım.",
           "english_sentence": "Wait for me for a while, I'll get you from home in ten minutes."
        },
        {
           "id": 1446,
           "turkish_word": "anlıyor",
           "english_word": "understands",
           "type": "v",
           "turkish_sentence": "Beni en iyi ablam anlıyor, onunla konuşmak istiyorum.",
           "english_sentence": "My sister understands me the most, I want to talk to her."
        },
        {
           "id": 1447,
           "turkish_word": "sevgili",
           "english_word": "boyfriend/girlfriend",
           "type": "n",
           "turkish_sentence": "Daha önce hiç sevgil inle seyahate çıktın mı?",
           "english_sentence": "Have you ever been on a trip with your boyfriend ?"
        },
        {
           "id": 1448,
           "turkish_word": "ölmüş",
           "english_word": "dead",
           "type": "adj",
           "turkish_sentence": "Bu yüz maskesi ile yüzünüzdeki ölmüş deriden kurtulacaksınız.",
           "english_sentence": "With this face mask, you will get rid of the dead skin on your face."
        },
        {
           "id": 1449,
           "turkish_word": "değiliz",
           "english_word": "we're not",
           "type": "v",
           "turkish_sentence": "Yarın resmi tatil dolayısıyla açık değiliz.",
           "english_sentence": "Tomorrow, we're not open due to the national holiday."
        },
        {
           "id": 1450,
           "turkish_word": "aşkına",
           "english_word": "for the sake of",
           "type": "postp",
           "turkish_sentence": "Allah aşkına, burada neler olduğunu bana açıklar misin?",
           "english_sentence": "For the sake of God, can you tell me what's going on here?"
        },
        {
           "id": 1451,
           "turkish_word": "babası",
           "english_word": "",
           "type": "n poss",
           "turkish_sentence": "Arkadaşımın babası bir restoranda aşçı olarak çalışıyormuş.",
           "english_sentence": "My friend's father was working in a restaurant as a cook.",
           "notes": "someone's"
        },
        {
           "id": 1452,
           "turkish_word": "suç",
           "english_word": "crime",
           "type": "n",
           "turkish_sentence": "Bir şahsa veya mekana fiziksel şiddet uygulamak kanunen suç sayılır.",
           "english_sentence": "Committing physical violence against a person or a place is regarded as a crime by law."
        },
        {
           "id": 1453,
           "turkish_word": "yemeği",
           "english_word": "meal of",
           "type": "n poss",
           "turkish_sentence": "Bugünün yemeği carbonara makarna ve domates çorbasıdır.",
           "english_sentence": "Today's meal is carbonara pasta and tomato soup."
        },
        {
           "id": 1454,
           "turkish_word": "burayı",
           "english_word": "here",
           "type": "adv",
           "turkish_sentence": "Burayı çok fazla bilmiyorum, bu yüzden de size yol tarif edemeyeceğim.",
           "english_sentence": "I don't know here so much, so I can't give you directions."
        },
        {
           "id": 1455,
           "turkish_word": "gayet",
           "english_word": "quite",
           "type": "adv",
           "turkish_sentence": "Açıklamalar gayet net, bir sorunuz olacağını sanmıyorum.",
           "english_sentence": "The instructions are quite clear, I don't think you will have a question."
        },
        {
           "id": 1456,
           "turkish_word": "umurumda",
           "english_word": "I care",
           "type": "~",
           "turkish_sentence": "Biletlerin pahalı olup olmaması senin umurunda olmayabilir, ama benim umurumda.",
           "english_sentence": "You may not care whether the tickets are expensive or not, but I care."
        },
        {
           "id": 1457,
           "turkish_word": "general",
           "english_word": "general",
           "type": "n",
           "turkish_sentence": "Hava Kuvvetleri General i, bugünkü askeri gösteriye katılacak.",
           "english_sentence": "The General of the Air Forces will attend to today's military program."
        },
        {
           "id": 1458,
           "turkish_word": "bok",
           "english_word": "shit",
           "type": "n",
           "turkish_sentence": "Bu sokaklar bok gibi kokuyor, buralar hiç temizlenmiyor mu?",
           "english_sentence": "These streets smell like shit, doesn’t anyone clean here?"
        },
        {
           "id": 1459,
           "turkish_word": "bizden",
           "english_word": "from us",
           "type": "adv",
           "turkish_sentence": "Bizden istediğiniz bir şey varsa söyleyebilirsiniz.",
           "english_sentence": "If you have anything you want from us, you can say so."
        },
        {
           "id": 1460,
           "turkish_word": "elinde",
           "english_word": "in one's hands",
           "type": "adv",
           "turkish_sentence": "Yarınki final sınavında başarılı olmak tamamen senin elinde.",
           "english_sentence": "Succeeding tomorrow's final exam is completely in your hands."
        },
        {
           "id": 1461,
           "turkish_word": "dürüst",
           "english_word": "honest",
           "type": "adj",
           "turkish_sentence": "Babam anneme karşı hep dürüst bir insan oldu, anneme yalan söylediğini bir kez bile duymadım.",
           "english_sentence": "My father has always been an honest person to my mother, I've never heard that he lied to my mom."
        },
        {
           "id": 1462,
           "turkish_word": "iyiyim",
           "english_word": "I'm fine",
           "type": "interj",
           "turkish_sentence": "Ben de iyiyim, sorduğun için teşekkür ederim.",
           "english_sentence": "I'm fine too, thank you for asking."
        },
        {
           "id": 1463,
           "turkish_word": "taksi",
           "english_word": "taxi",
           "type": "n",
           "turkish_sentence": "Arkadaşım buraya gelen son treni kaçırdı ve taksi tutmak zorunda kaldı.",
           "english_sentence": "My friend missed the last train coming here and had to take a taxi."
        },
        {
           "id": 1464,
           "turkish_word": "yargıç",
           "english_word": "judge",
           "type": "n",
           "turkish_sentence": "Yargıç tokmağını vurdu ve kararı açıkladı.",
           "english_sentence": "The judge banged his gavel and announced the verdict."
        },
        {
           "id": 1465,
           "turkish_word": "affedersin",
           "english_word": "sorry",
           "type": "interj",
           "turkish_sentence": "Affedersin, yarın İngilizce sınavı için beni çalıştırır mısın?",
           "english_sentence": "Sorry, but can you train me for tomorrow's English exam?"
        },
        {
           "id": 1466,
           "turkish_word": "eğlenceli",
           "english_word": "fun",
           "type": "adj",
           "turkish_sentence": "Senin sayende dün akşam çok eğlenceli bir akşam geçirdik, çok teşekkür ederiz.",
           "english_sentence": "Thanks to you, we had a very fun night yesterday; thank you very much."
        },
        {
           "id": 1467,
           "turkish_word": "kayıp",
           "english_word": "lost",
           "type": "n",
           "turkish_sentence": "Kayıp eşya sorgulamak için AVM'nin giriş katındaki güvenlik bürosuna danışınız.",
           "english_sentence": "Please consult the security office in the first floor in order to check the lost items."
        },
        {
           "id": 1468,
           "turkish_word": "gerekiyordu",
           "english_word": "needed",
           "type": "v",
           "turkish_sentence": "Bu elbise tasarımını bitirebilmek için biraz zaman gerekiyordu, ancak süre kısıtlıydı.",
           "english_sentence": "Finishing this design needed some time, but the time was very limited."
        },
        {
           "id": 1469,
           "turkish_word": "yaptığın",
           "english_word": "that you did",
           "type": "ptcp",
           "turkish_sentence": "Şimdiye kadar yaptığın en aptalca davranış neydi?",
           "english_sentence": "What was the most stupid behavior you did so far?"
        },
        {
           "id": 1470,
           "turkish_word": "onlarla",
           "english_word": "with them",
           "type": "adv",
           "turkish_sentence": "Onlarla dışarı çıkmak istemiyorum, çünkü hepsi çok sıkıcı.",
           "english_sentence": "I don't want to go out with them, because they're all so boring."
        },
        {
           "id": 1471,
           "turkish_word": "çocukları",
           "english_word": "the kids",
           "type": "n",
           "turkish_sentence": "Bir geceliğine çocukları bakıcıya bırakıp baş başa dışarı çıkalım istiyorum.",
           "english_sentence": "I want to leave the kids to the babysitter for one night and go out by ourselves."
        },
        {
           "id": 1472,
           "turkish_word": "teklif",
           "english_word": "offer",
           "type": "n",
           "turkish_sentence": "Dünyaca ünlü bir şirketten iş teklif i aldım, ama kabul edersem Çin'de çalışmam gerekecek.",
           "english_sentence": "I received a job offer from a company known worldwide, but if I accept it, I will have to work in China."
        },
        {
           "id": 1473,
           "turkish_word": "seviyor",
           "english_word": "loves",
           "type": "v",
           "turkish_sentence": "Erkek kardeşim mantıyı çok seviyor diye, annemle birlikte bir sürü mantı yaptık.",
           "english_sentence": "My mother and I made lots of dumplings because my brother loves them very much."
        },
        {
           "id": 1474,
           "turkish_word": "bekleyin",
           "english_word": "wait",
           "type": "v",
           "turkish_sentence": "Beş dakika bekleyin lütfen, sizi yetkili kişiye aktarıyorum.",
           "english_sentence": "Please wait for five minutes, I'm transferring you to the person in charge."
        },
        {
           "id": 1475,
           "turkish_word": "babamın",
           "english_word": "my father's",
           "type": "n",
           "turkish_sentence": "Babamın kredi kartını kullanmak için önce izin almam gerek.",
           "english_sentence": "I have to get my father's permission to use his credit card."
        },
        {
           "id": 1476,
           "turkish_word": "çalışıyorsun",
           "english_word": "you're working",
           "type": "v",
           "turkish_sentence": "Neredeyse her gün çalışıyorsun, ne zaman bana vakit ayıracaksın?",
           "english_sentence": "You're working almost every day; when will you spare time for me?"
        },
        {
           "id": 1477,
           "turkish_word": "soğuk",
           "english_word": "cold",
           "type": "adj",
           "turkish_sentence": "Aralık ayında olmamıza rağmen hava çok da soğuk değil.",
           "english_sentence": "Although we are in December now, the weather is not so cold."
        },
        {
           "id": 1478,
           "turkish_word": "katil",
           "english_word": "murderer",
           "type": "n",
           "turkish_sentence": "Yıllardır aranan katil aslında çok yakınımızda imiş.",
           "english_sentence": "The murderer, wanted for years, was in fact so close to us."
        },
        {
           "id": 1479,
           "turkish_word": "yaşıyor",
           "english_word": "is living",
           "type": "v",
           "turkish_sentence": "Kardeşim üniversiteye başladığı için şu an başka bir şehirde yaşıyor.",
           "english_sentence": "My sister is living in another city right now, because she has just started university."
        },
        {
           "id": 1480,
           "turkish_word": "iyisi",
           "english_word": "good",
           "type": "adj",
           "turkish_sentence": "Portakalın iyisi ve faydalısı Akdeniz'de bulunur.",
           "english_sentence": "A good and nutritious orange can be found in the Mediterranean region."
        },
        {
           "id": 1481,
           "turkish_word": "internet sitesi",
           "english_word": "website",
           "type": "n",
           "turkish_sentence": "Moda ve güzellik ile ilgili bir internet sitesi açmak istiyorum.",
           "english_sentence": "I want to open a website about fashion and beauty."
        },
        {
           "id": 1482,
           "turkish_word": "söyleyeyim",
           "english_word": "let me say",
           "type": "~",
           "turkish_sentence": "İstediğini yapmakta özgürsün, lakin bu işi pek onaylamadığımı da söyleyeyim.",
           "english_sentence": "You're free to do what you want, but let me say that I don't approve."
        },
        {
           "id": 1483,
           "turkish_word": "istemiyor",
           "english_word": "doesn't want",
           "type": "v",
           "turkish_sentence": "Evlendikten hemen sonra çocuk sahibi olmak istemiyor, ama erkek arkadaşı aynı şeyi düşünmüyor.",
           "english_sentence": "She doesn't want to have a child immediately after marriage, but her boyfriend doesn't think the same."
        },
        {
           "id": 1484,
           "turkish_word": "gitsin",
           "english_word": "go",
           "type": "v",
           "turkish_sentence": "O adam hemen bu evden gitsin istiyorum!",
           "english_sentence": "I want that man to go away from this house, now!"
        },
        {
           "id": 1485,
           "turkish_word": "Cansu",
           "english_word": "Cansu",
           "type": "n",
           "turkish_sentence": "Cansu depremden sonra evini ve ailesini kaybetti, şimdi tek başına hayatta kalmaya çalışıyor.",
           "english_sentence": "Cansu lost her home and family after the earthquake, she is now trying to survive on her own.",
           "notes": "feminine name"
        },
        {
           "id": 1486,
           "turkish_word": "baksana",
           "english_word": "look",
           "type": "interj",
           "turkish_sentence": "Şu elbiseye baksana, tam benim aradığım tarzda!",
           "english_sentence": "Look at this dress, it's exactly the same style I'm looking for!"
        },
        {
           "id": 1487,
           "turkish_word": "düğün",
           "english_word": "wedding",
           "type": "n",
           "turkish_sentence": "Düğün, kötü hava koşulları nedeniyle ertelendi.",
           "english_sentence": "The wedding has been postponed due to bad weather."
        },
        {
           "id": 1488,
           "turkish_word": "gurur",
           "english_word": "pride",
           "type": "n",
           "turkish_sentence": "Her insanda gurur duygusu vardır, ama bazen bu duyguyu kontrol altına almayı bilmeliyiz.",
           "english_sentence": "Everybody has a feeling of pride, but sometimes we need to know how to control this feeling."
        },
        {
           "id": 1489,
           "turkish_word": "tanıyor",
           "english_word": "knows",
           "type": "v",
           "turkish_sentence": "Piyano öğretmenim Türkiye'deki ünlü piyanistlerin çoğunu bizzat tanıyor.",
           "english_sentence": "My piano teacher knows almost every famous pianist in Turkey in person."
        },
        {
           "id": 1490,
           "turkish_word": "geldiniz",
           "english_word": "you came",
           "type": "v",
           "turkish_sentence": "Sergime iyi ki geldiniz, sizi görünce çok mutlu oldum.",
           "english_sentence": "I'm glad that you came to my exhibition, I am very happy to see you."
        },
        {
           "id": 1491,
           "turkish_word": "arkadaşı",
           "english_word": "",
           "type": "n poss",
           "turkish_sentence": "Duydum ki yarınki Uludağ gezisine Ayhan'ın arkadaşı da gelecekmiş.",
           "english_sentence": "I heard that Ayhan's friend would also come on the Uludağ trip tomorrow.",
           "notes": "someone's"
        },
        {
           "id": 1492,
           "turkish_word": "Mine",
           "english_word": "Mine",
           "type": "n",
           "turkish_sentence": "Mine bir elektronik şirketinde mühendis olarak çalışıyor ama işinden memnun değil.",
           "english_sentence": "Mine works as an engineer in an electronics company but she is not happy with her job.",
           "notes": "feminine name"
        },
        {
           "id": 1493,
           "turkish_word": "siyah",
           "english_word": "black",
           "type": "adj",
           "turkish_sentence": "Kıyafetlerim genellikle siyah ve tonları renklerindedir, çünkü siyah her zaman şık gösterir.",
           "english_sentence": "My clothes are usually black and its shades, because black always looks chic."
        },
        {
           "id": 1494,
           "turkish_word": "göster",
           "english_word": "show",
           "type": "v",
           "turkish_sentence": "Hadi bana bugün alışverişte neler aldığını göster, çok merak ediyorum.",
           "english_sentence": "Show me what you bought from shopping today, I am very curious."
        },
        {
           "id": 1495,
           "turkish_word": "saç",
           "english_word": "hair",
           "type": "n",
           "turkish_sentence": "Dışarı çıkmadan önce saç ımı yıkamam gerek.",
           "english_sentence": "I need to wash my hair before going out."
        },
        {
           "id": 1496,
           "turkish_word": "boş ver",
           "english_word": "never mind",
           "type": "interj",
           "turkish_sentence": "Senden benim için bir iyilik yapmanı isteyecektim, ama boş ver.",
           "english_sentence": "I was going to ask you to do me a favor but never mind."
        },
        {
           "id": 1497,
           "turkish_word": "kapı",
           "english_word": "door",
           "type": "n",
           "turkish_sentence": "Lütfen çıkışlar için arkadaki kapı yı kullanınız, ön kapı sadece girişler için geçerlidir.",
           "english_sentence": "Please use the back door for the exit; the front door is only for the entrance."
        },
        {
           "id": 1498,
           "turkish_word": "patron",
           "english_word": "boss",
           "type": "n",
           "turkish_sentence": "Bir önceki patron um çok katı bir adamdı, ama şu anki patron umdan memnunum.",
           "english_sentence": "My previous boss was a very strict man, but now I'm content with my current boss."
        },
        {
           "id": 1499,
           "turkish_word": "istiyoruz",
           "english_word": "we want",
           "type": "v",
           "turkish_sentence": "Bugün akşam yemeğinde hamburger yemek istiyoruz.",
           "english_sentence": "Tonight we want to eat hamburger for dinner."
        },
        {
           "id": 1500,
           "turkish_word": "tarafa",
           "english_word": "side",
           "type": "n",
           "turkish_sentence": "Yakındaki kavşağı geçtikten sonra ne tarafa döneyim?",
           "english_sentence": "After passing the crossroad nearby, which side should I turn?"
        },
        {
           "id": 1501,
           "turkish_word": "anlaşma",
           "english_word": "agreement",
           "type": "n",
           "turkish_sentence": "Yaklaşık beş saat tartıştıktan sonra sonunda bir anlaşmaya vardılar.",
           "english_sentence": "After debating for about five hours, they finally came to an agreement."
        },
        {
           "id": 1502,
           "turkish_word": "cumartesi",
           "english_word": "Saturday",
           "type": "n",
           "turkish_sentence": "En sevdiğim Youtuber bu cumartesi yayın yapacak.",
           "english_sentence": "My favorite Youtuber will be streaming on this Saturday."
        },
        {
           "id": 1503,
           "turkish_word": "geldiğini",
           "english_word": "that you/he/she came",
           "type": "ptcp",
           "turkish_sentence": "Geldiğini fark etmediğim için seni aniden görünce korktum.",
           "english_sentence": "I got scared when I saw you suddenly because I didn’t realize that you came."
        },
        {
           "id": 1504,
           "turkish_word": "dinleyin",
           "english_word": "listen",
           "type": "v",
           "turkish_sentence": "Beni dinleyin.",
           "english_sentence": "Listen to me."
        },
        {
           "id": 1505,
           "turkish_word": "eskiden",
           "english_word": "once",
           "type": "adv",
           "turkish_sentence": "Teksas eskiden Meksika tarafından yönetiliyordu.",
           "english_sentence": "Texas was once ruled by Mexico."
        },
        {
           "id": 1506,
           "turkish_word": "görmedim",
           "english_word": "I didn’t see",
           "type": "v",
           "turkish_sentence": "Babannemin ameliyattan çıktığını söylediler ama onu görmedim.",
           "english_sentence": "They told me that my grandmother came out of the surgery, but I didn’t see her."
        },
        {
           "id": 1507,
           "turkish_word": "yarım",
           "english_word": "half",
           "type": "adj",
           "turkish_sentence": "Kahvaltıda yarım somun ekmek yedim.",
           "english_sentence": "I ate half a loaf of bread at breakfast."
        },
        {
           "id": 1508,
           "turkish_word": "fikrim",
           "english_word": "my idea",
           "type": "n",
           "turkish_sentence": "Yürüyüşe çıkmak benim fikrim değildi.",
           "english_sentence": "It wasn’t my idea to go for a walk."
        },
        {
           "id": 1509,
           "turkish_word": "duyuyor",
           "english_word": "he/she is hearing",
           "type": "v",
           "turkish_sentence": "Kardeşin bizi dinlemiyor sanıyorsun, ama o bütün konuştuklarımızı duyuyor.",
           "english_sentence": "You think your brother is not listening to us, but he is hearing everything we say."
        },
        {
           "id": 1510,
           "turkish_word": "olmasın",
           "english_word": "not",
           "type": "adv",
           "turkish_sentence": "Neden olmasın ?",
           "english_sentence": "Why not ?"
        },
        {
           "id": 1511,
           "turkish_word": "arabayı",
           "english_word": "the car",
           "type": "n",
           "turkish_sentence": "Yarın arabayı yıkayacak.",
           "english_sentence": "He is going to wash the car tomorrow."
        },
        {
           "id": 1512,
           "turkish_word": "yo",
           "english_word": "no",
           "type": "interj",
           "turkish_sentence": "Yo, bu senin hatan değildi.",
           "english_sentence": "No, it wasn’t your fault."
        },
        {
           "id": 1513,
           "turkish_word": "günler",
           "english_word": "days",
           "type": "n pl",
           "turkish_sentence": "Yaşamımızdaki bazı günler bir takvimdeki resimler gibi güzeldir.",
           "english_sentence": "Some of the days in our lives are as beautiful as pictures in a calendar."
        },
        {
           "id": 1514,
           "turkish_word": "süper",
           "english_word": "super",
           "type": "adj",
           "turkish_sentence": "Her kahramanın süper gücü yoktur.",
           "english_sentence": "Not every hero has super abilities."
        },
        {
           "id": 1515,
           "turkish_word": "niçin",
           "english_word": "why",
           "type": "adv",
           "turkish_sentence": "Niçin beni takip ediyorsun?",
           "english_sentence": "Why are you following me?"
        },
        {
           "id": 1516,
           "turkish_word": "orası",
           "english_word": "there",
           "type": "n",
           "turkish_sentence": "Orası yazın bile soğuk.",
           "english_sentence": "It’s cold there, even in summer."
        },
        {
           "id": 1517,
           "turkish_word": "salak",
           "english_word": "idiot",
           "type": "adv",
           "turkish_sentence": "Sonunda insanların neden sana salak dediğini anlamaya başladım.",
           "english_sentence": "I finally came to realize why people keep calling you idiot."
        },
        {
           "id": 1518,
           "turkish_word": "adama",
           "english_word": "to the man",
           "type": "pron",
           "turkish_sentence": "Bence flörtleştiğin adama numaranı vermelisin.",
           "english_sentence": "I think you should give your number to the man that you have been flirting with."
        },
        {
           "id": 1519,
           "turkish_word": "çocuğun",
           "english_word": "your kid",
           "type": "n",
           "turkish_sentence": "Çocuğun o kadar yaramaz ki beni çılgına çeviriyor.",
           "english_sentence": "Your kid is so naughty that he/she is driving me crazy."
        },
        {
           "id": 1520,
           "turkish_word": "davet",
           "english_word": "invitation",
           "type": "n",
           "turkish_sentence": "Kokteyl partisine davet i kabul etti.",
           "english_sentence": "She accepted the invitation to the cocktail party."
        },
        {
           "id": 1521,
           "turkish_word": "zorundayım",
           "english_word": "I have to",
           "type": "v",
           "turkish_sentence": "Sinir bozucu kardeşimin kahrını çekmek zorundayım.",
           "english_sentence": "I have to put up with my annoying sister."
        },
        {
           "id": 1522,
           "turkish_word": "düşünüyordum",
           "english_word": "I was thinking",
           "type": "v",
           "turkish_sentence": "Beni aradığında alışverişe çıkmayı düşünüyordum.",
           "english_sentence": "I was thinking of going shopping when he called me."
        },
        {
           "id": 1523,
           "turkish_word": "kendime",
           "english_word": "to myself",
           "type": "adv",
           "turkish_sentence": "Kendime bunu yapamam.",
           "english_sentence": "I can’t do this to myself."
        },
        {
           "id": 1524,
           "turkish_word": "kalmak",
           "english_word": "to stay",
           "type": "v",
           "turkish_sentence": "Annem burada kalmak tan memnun.",
           "english_sentence": "My mom is happy to stay here."
        },
        {
           "id": 1525,
           "turkish_word": "gelmek",
           "english_word": "to come",
           "type": "v",
           "turkish_sentence": "Hasan’ı almayı teklif ettim fakat o kendisi gelmek istedi.",
           "english_sentence": "I offered to pick Hasan up, but he wanted to come by himself."
        },
        {
           "id": 1526,
           "turkish_word": "yaptığım",
           "english_word": "that I did/made",
           "type": "ptcp",
           "turkish_sentence": "Yaptığım en büyük hata sana inanmaktı.",
           "english_sentence": "The greatest mistake that I made was to believe you."
        },
        {
           "id": 1527,
           "turkish_word": "öğrenmek",
           "english_word": "to learn",
           "type": "v",
           "turkish_sentence": "Türkçe öğrenmek için İstanbul’a taşındı.",
           "english_sentence": "He moved to İstanbul in order to learn Turkish."
        },
        {
           "id": 1528,
           "turkish_word": "kalp",
           "english_word": "heart",
           "type": "n",
           "turkish_sentence": "Kalp atışlarım çok düşüktü.",
           "english_sentence": "My heart rate was very low."
        },
        {
           "id": 1529,
           "turkish_word": "aşık",
           "english_word": "in love",
           "type": "adj",
           "turkish_sentence": "Ben ona aşık tım ama o beni sevmedi.",
           "english_sentence": "I was in love with her, but she didn’t love me."
        },
        {
           "id": 1530,
           "turkish_word": "kalın",
           "english_word": "thick",
           "type": "adj",
           "turkish_sentence": "Bu kitap o kadar kalın ki bitirebileceğimi sanmıyorum.",
           "english_sentence": "This book is so thick that I don’t think I can finish reading it."
        },
        {
           "id": 1531,
           "turkish_word": "istemedim",
           "english_word": "I didn’t want",
           "type": "v",
           "turkish_sentence": "Onunla dışarı çıkmak istemedim çünkü bana karşı çok kabaydı.",
           "english_sentence": "I didn’t want to go out with him because he was very mean to me."
        },
        {
           "id": 1532,
           "turkish_word": "çoktan",
           "english_word": "already",
           "type": "adv",
           "turkish_sentence": "Salgın Asya’da çoktan başladı.",
           "english_sentence": "The outbreak has already started in Asia."
        },
        {
           "id": 1533,
           "turkish_word": "arka",
           "english_word": "back",
           "type": "n",
           "turkish_sentence": "Onu arka sından vurmamı istedi.",
           "english_sentence": "She wanted me to shoot him in the back."
        },
        {
           "id": 1534,
           "turkish_word": "Noel",
           "english_word": "Christmas",
           "type": "n",
           "turkish_sentence": "Mutlu Noel ler!",
           "english_sentence": "Merry Christmas !"
        },
        {
           "id": 1535,
           "turkish_word": "iyilik",
           "english_word": "favor, good",
           "type": "n",
           "turkish_sentence": "Bana bir iyilik yap ve bunu ona söyleme.",
           "english_sentence": "Do me a favor and don’t tell him about it."
        },
        {
           "id": 1536,
           "turkish_word": "hepiniz",
           "english_word": "you all",
           "type": "pron",
           "turkish_sentence": "Hepiniz yetişkin bir adam gibi davranmayı öğrenmek zorundasınız.",
           "english_sentence": "You all have to learn how to behave like grown men."
        },
        {
           "id": 1537,
           "turkish_word": "taraftan",
           "english_word": "from",
           "type": "adv",
           "turkish_sentence": "Askerler sol taraftan geliyor.",
           "english_sentence": "Troops are coming from the left side."
        },
        {
           "id": 1538,
           "turkish_word": "şef",
           "english_word": "chef",
           "type": "n",
           "turkish_sentence": "Yeni bir lokantada şef olarak işe başladım.",
           "english_sentence": "I started my new job as chef at a new restaurant."
        },
        {
           "id": 1539,
           "turkish_word": "görmek",
           "english_word": "to see",
           "type": "adv",
           "turkish_sentence": "İki FBI ajanı seni görme ye gelmiş.",
           "english_sentence": "Two FBI agents are here to see you."
        },
        {
           "id": 1540,
           "turkish_word": "istemem",
           "english_word": "I don’t want",
           "type": "v",
           "turkish_sentence": "Köpeğine dikkat et! Beni ısırmasını istemem.",
           "english_sentence": "Watch your dog! I don’t want it to bite me."
        },
        {
           "id": 1541,
           "turkish_word": "ellerini",
           "english_word": "your/his/her hands",
           "type": "n",
           "turkish_sentence": "Ellerini çok sık yıkamıyor.",
           "english_sentence": "He doesn’t wash his hands so often."
        },
        {
           "id": 1542,
           "turkish_word": "hoşuma",
           "english_word": "to like",
           "type": "v",
           "turkish_sentence": "Kocamın yıl dönümümüz için aldığı hediye çok hoşuma gitti.",
           "english_sentence": "I really liked the present that my husband bought for our anniversary.",
           "notes": "always used in a form of hoşuna + gitmek"
        },
        {
           "id": 1543,
           "turkish_word": "bul",
           "english_word": "find",
           "type": "v",
           "turkish_sentence": "Kalacak daha iyi bir yer bul.",
           "english_sentence": "Find a better place to stay."
        },
        {
           "id": 1544,
           "turkish_word": "çeşit",
           "english_word": "kind of/sort of",
           "type": "adj",
           "turkish_sentence": "Yaşam süresini uzatan bir çeşit teknolojileri var.",
           "english_sentence": "They have some sort of technology that prolongs life."
        },
        {
           "id": 1545,
           "turkish_word": "sekiz",
           "english_word": "eight",
           "type": "num",
           "turkish_sentence": "Bazı ülkelerde, insanlar sekiz saatten fazla çalışır.",
           "english_sentence": "In some countries, people work more than eight hours."
        },
        {
           "id": 1546,
           "turkish_word": "bakayım",
           "english_word": "let me look",
           "type": "v",
           "turkish_sentence": "Yaraya bakayım. Acıyor mu?",
           "english_sentence": "Let me look at the wound. Does it hurt?"
        },
        {
           "id": 1547,
           "turkish_word": "herkese",
           "english_word": "to everyone",
           "type": "adv",
           "turkish_sentence": "Doğum günümü kutlayan herkese teşekkür ederim.",
           "english_sentence": "Thank you to everyone who celebrated my birthday."
        },
        {
           "id": 1548,
           "turkish_word": "olayı",
           "english_word": "the incident",
           "type": "n",
           "turkish_sentence": "Dünkü olayı duydun mu?",
           "english_sentence": "Did you hear about the incident yesterday?"
        },
        {
           "id": 1549,
           "turkish_word": "aferin",
           "english_word": "well done",
           "type": "interj",
           "turkish_sentence": "Aferin ! Seninle gurur duyuyorum.",
           "english_sentence": "Well done ! I’m so proud of you."
        },
        {
           "id": 1550,
           "turkish_word": "günün",
           "english_word": "your day, of the day",
           "type": "n",
           "turkish_sentence": "Günün nasıl geçti?",
           "english_sentence": "How was your day ?"
        },
        {
           "id": 1551,
           "turkish_word": "verici",
           "english_word": "",
           "type": "adj",
           "turkish_sentence": "Hepimizin {utanç} verici anıları var. We all have embarrassing stories.",
           "english_sentence": "Seni başka bir adamla görmek çok {acı} verici. It is very painful to see you with another guy.",
           "notes": "used in a form of {emotion} + verici, meaning may vary depending on the word used"
        },
        {
           "id": 1552,
           "turkish_word": "hatırlıyorum",
           "english_word": "I remember",
           "type": "v",
           "turkish_sentence": "Selim ile buraya geldiğimiz zamanları hatırlıyorum.",
           "english_sentence": "I remember when Selim and I used to come here."
        },
        {
           "id": 1553,
           "turkish_word": "vereceğim",
           "english_word": "I will give/I am going to give",
           "type": "v",
           "turkish_sentence": "Sahip olduğumuz her şeyi ona vereceğim.",
           "english_sentence": "I’m going to give him everything we have."
        },
        {
           "id": 1554,
           "turkish_word": "konuş",
           "english_word": "talk",
           "type": "v",
           "turkish_sentence": "O çok üzgün görünüyor. Git konuş onunla.",
           "english_sentence": "She looks very sad. Go up there, talk to her."
        },
        {
           "id": 1555,
           "turkish_word": "mavi",
           "english_word": "blue",
           "type": "adj",
           "turkish_sentence": "Mavi balinanın sesi 500 mil uzaktan duyulabilir.",
           "english_sentence": "The blue whale’s sound can be heard at a distance of over 500 miles."
        },
        {
           "id": 1556,
           "turkish_word": "kavga",
           "english_word": "fight, fighting",
           "type": "n",
           "turkish_sentence": "Babam her zaman kavga nın ilk değil, son çare olduğunu söylerdi.",
           "english_sentence": "My father always used to say that fighting is the last resort, not the first."
        },
        {
           "id": 1557,
           "turkish_word": "getirdim",
           "english_word": "I brought",
           "type": "v",
           "turkish_sentence": "Aç olduğunu düşündüm ve sana yiyecek getirdim.",
           "english_sentence": "I thought you were hungry and I brought you some food."
        },
        {
           "id": 1558,
           "turkish_word": "istiyorsunuz",
           "english_word": "you",
           "type": "v",
           "turkish_sentence": "Ne yapmamı istiyorsunuz ?",
           "english_sentence": "What do you want me to do?",
           "notes": "plural/formal) want (continuous"
        },
        {
           "id": 1559,
           "turkish_word": "çekilin",
           "english_word": "you",
           "type": "v",
           "turkish_sentence": "Geri çekilin yoksa vuracağım!",
           "english_sentence": "Stand back or I will shoot!",
           "notes": "plural/formal) stand back (imperative"
        },
        {
           "id": 1560,
           "turkish_word": "gider",
           "english_word": "he/she/it goes",
           "type": "v",
           "turkish_sentence": "Herkes gider, anılar kalır.",
           "english_sentence": "Everyone goes, memories remain."
        },
        {
           "id": 1561,
           "turkish_word": "telefonu",
           "english_word": "phone",
           "type": "n",
           "turkish_sentence": "Yeni aldığın telefonu kırdın mı?",
           "english_sentence": "Did you break the phone you have bought recently?",
           "notes": "accusative"
        },
        {
           "id": 1562,
           "turkish_word": "bira",
           "english_word": "beer",
           "type": "n",
           "turkish_sentence": "Haydi dışarı çıkıp bira içelim!",
           "english_sentence": "Let’s go out and drink beer !"
        },
        {
           "id": 1563,
           "turkish_word": "şimdiye dek",
           "english_word": "by now",
           "type": "adv",
           "turkish_sentence": "Şimdiye dek sınavlarına çalışmış olman gerekirdi.",
           "english_sentence": "You should have been studying for your exams by now."
        },
        {
           "id": 1564,
           "turkish_word": "birileri",
           "english_word": "someone",
           "type": "pron",
           "turkish_sentence": "Sanki birileri benim hakkımda konuşuyor.",
           "english_sentence": "I feel like someone is talking about me.",
           "notes": "plural"
        },
        {
           "id": 1565,
           "turkish_word": "gitmeliyim",
           "english_word": "I must go",
           "type": "v",
           "turkish_sentence": "Hava kararmadan evime gitmeliyim.",
           "english_sentence": "I must go home before it gets dark."
        },
        {
           "id": 1566,
           "turkish_word": "çıkmış",
           "english_word": "he/she/it has got out",
           "type": "v",
           "turkish_sentence": "Bana haber vermeden dışarı çıkmış.",
           "english_sentence": "She has got out without noticing me."
        },
        {
           "id": 1567,
           "turkish_word": "baylar",
           "english_word": "gentlemen",
           "type": "n",
           "turkish_sentence": "Baylar -bayanlar, işte karşınızda yarışmamızın birincisi!",
           "english_sentence": "Ladies and gentlemen, please welcome the winner of our contest!"
        },
        {
           "id": 1568,
           "turkish_word": "güven",
           "english_word": "trust",
           "type": "n",
           "turkish_sentence": "Gerçek bir ilişkide, güven ve saygı bir aradadır.",
           "english_sentence": "Trust and respect coexist in a true relationship."
        },
        {
           "id": 1569,
           "turkish_word": "duymak",
           "english_word": "hearing, to hear",
           "type": "ptcp",
           "turkish_sentence": "Şehrin gürültüsünü duymak beni yoruyor.",
           "english_sentence": "Hearing the noise of the city is tiring me out."
        },
        {
           "id": 1570,
           "turkish_word": "herkesi",
           "english_word": "everyone",
           "type": "pron",
           "turkish_sentence": "Herkesi kendin gibi mi sanıyorsun?",
           "english_sentence": "Do you think that everyone is like you?",
           "notes": "accusative, plural"
        },
        {
           "id": 1571,
           "turkish_word": "sigara",
           "english_word": "cigarette",
           "type": "n",
           "turkish_sentence": "Bunca yolu, bir paket sigara almak için mi yürüdün?",
           "english_sentence": "Did you walk all this way just to buy a packet of cigarette s?"
        },
        {
           "id": 1572,
           "turkish_word": "dedektif",
           "english_word": "detective",
           "type": "n",
           "turkish_sentence": "Dedektif, suçluya ilişkin henüz bir ipucu bulamadığını söyledi.",
           "english_sentence": "The detective said that he couldn’t find any clues about the criminal yet."
        },
        {
           "id": 1573,
           "turkish_word": "oldun",
           "english_word": "You have been…",
           "type": "v",
           "turkish_sentence": "Sen her zaman hayatımdaki en yardımsever insan oldun.",
           "english_sentence": "You have always been the most helpful person in my life."
        },
        {
           "id": 1574,
           "turkish_word": "düşünmüştüm",
           "english_word": "I have thought…",
           "type": "v",
           "turkish_sentence": "Senin de beni sevdiğini düşünmüştüm.",
           "english_sentence": "I have thought that you loved me back."
        },
        {
           "id": 1575,
           "turkish_word": "severim",
           "english_word": "I like…",
           "type": "v",
           "turkish_sentence": "Güneşli günlerde doğa yürüyüşüne çıkmayı severim.",
           "english_sentence": "I like going on a nature walk in sunny days."
        },
        {
           "id": 1576,
           "turkish_word": "gidecek",
           "english_word": "he/she/it will go",
           "type": "v",
           "turkish_sentence": "Endişelenmene gerek yok, her şey yolunda gidecek.",
           "english_sentence": "No need to worry, everything will go right."
        },
        {
           "id": 1577,
           "turkish_word": "kral",
           "english_word": "king",
           "type": "n",
           "turkish_sentence": "Monarşide hükümdara “kral ” denir.",
           "english_sentence": "The ruler in a monarchy is called “king ”."
        },
        {
           "id": 1578,
           "turkish_word": "aptalca",
           "english_word": "stupidly",
           "type": "adv",
           "turkish_sentence": "Bu kadar aptalca davranmayı ne zaman keseceksin?",
           "english_sentence": "When will you stop acting so stupidly ?"
        },
        {
           "id": 1579,
           "turkish_word": "zengin",
           "english_word": "rich",
           "type": "adv",
           "turkish_sentence": "Yakında zengin olmayı planlıyorum.",
           "english_sentence": "I’m planning to be rich soon."
        },
        {
           "id": 1580,
           "turkish_word": "elini",
           "english_word": "hand of 2 nd and 3 rd person",
           "type": "n",
           "turkish_sentence": "Karşıdan karşıya geçerken babanın elini tutmalısın.",
           "english_sentence": "You must hold your father’s hand while crossing over the road.",
           "notes": "accusative"
        },
        {
           "id": 1581,
           "turkish_word": "cehenneme",
           "english_word": "hell",
           "type": "n",
           "turkish_sentence": "Cehenneme kadar yolun var!",
           "english_sentence": "You can go to hell !",
           "notes": "dative"
        },
        {
           "id": 1582,
           "turkish_word": "olabilirim",
           "english_word": "I could be…",
           "type": "v",
           "turkish_sentence": "Senin hakkında yanılmış olabilirim.",
           "english_sentence": "I could have been wrong about you."
        },
        {
           "id": 1583,
           "turkish_word": "kapat",
           "english_word": "close",
           "type": "v",
           "turkish_sentence": "Burası çok soğuk, lütfen pencereyi kapat.",
           "english_sentence": "It’s very cold here, please close the window.",
           "notes": "imperative"
        },
        {
           "id": 1584,
           "turkish_word": "hatırladın",
           "english_word": "you remembered",
           "type": "n",
           "turkish_sentence": "Beni hatırladın mı?",
           "english_sentence": "Did you remember me?"
        },
        {
           "id": 1585,
           "turkish_word": "cidden",
           "english_word": "seriously",
           "type": "adv",
           "turkish_sentence": "Düzensiz uyumak sağlığımız açısından cidden kötüdür.",
           "english_sentence": "It is seriously bad for our health to sleep irregularly."
        },
        {
           "id": 1586,
           "turkish_word": "adın",
           "english_word": "your name",
           "type": "n",
           "turkish_sentence": "Bak, katkıda bulunanlar listesinde adın geçiyor!",
           "english_sentence": "Look, your name is in the contributors list!"
        },
        {
           "id": 1587,
           "turkish_word": "saatte",
           "english_word": "at",
           "type": "adv",
           "turkish_sentence": "Bu saatte burada ne yapıyorsun?",
           "english_sentence": "What are you doing here at this hour ?",
           "notes": "this"
        },
        {
           "id": 1588,
           "turkish_word": "dua",
           "english_word": "prayer",
           "type": "n",
           "turkish_sentence": "Dua, kişi ile yaratıcısı arasındaki köprüdür.",
           "english_sentence": "A prayer is the bridge between the person and the creator."
        },
        {
           "id": 1589,
           "turkish_word": "gittim",
           "english_word": "I went",
           "type": "v",
           "turkish_sentence": "Geçen yaz, kafamı dinlemek için Akdeniz kıyılarına gittim.",
           "english_sentence": "Last year, I went to Mediterrenean shores in order to rest my head."
        },
        {
           "id": 1590,
           "turkish_word": "edeyim",
           "english_word": "auxiliary word used after nouns; let me do/make",
           "type": "v",
           "turkish_sentence": "(optative) Size durumu farklı bir şekilde ifade edeyim.",
           "english_sentence": "Let me explain it in a different way."
        },
        {
           "id": 1591,
           "turkish_word": "söylemiştim",
           "english_word": "I have told…",
           "type": "v",
           "turkish_sentence": "Sana bunların olacağını söylemiştim.",
           "english_sentence": "I have told you that these things would happen."
        },
        {
           "id": 1592,
           "turkish_word": "isterdim",
           "english_word": "I wished",
           "type": "v",
           "turkish_sentence": "Beraber film izleyebilmek isterdim.",
           "english_sentence": "I wished that we could watch movies together."
        },
        {
           "id": 1593,
           "turkish_word": "yapmayı",
           "english_word": "to do",
           "type": "ptcp",
           "turkish_sentence": "Tüm bu hayal ettiklerini yapmayı ne zaman başaracaksın?",
           "english_sentence": "When will you be able to do all these things that you dream of?",
           "notes": "accusative"
        },
        {
           "id": 1594,
           "turkish_word": "olman",
           "english_word": "that you are",
           "type": "ptcp",
           "turkish_sentence": "Her şeyden önemlisi, yanımda olman.",
           "english_sentence": "The most important thing is that you are with me."
        },
        {
           "id": 1595,
           "turkish_word": "dava",
           "english_word": "case, lawsuit",
           "type": "n",
           "turkish_sentence": "Dava sonucu, hepimizi endişelendiriyor.",
           "english_sentence": "Case result is troubling us all."
        },
        {
           "id": 1596,
           "turkish_word": "yüzbaşı",
           "english_word": "captain, lieutenant",
           "type": "n",
           "turkish_sentence": "Yüzbaşı, askerlerine, geri çekilmelerini emretti.",
           "english_sentence": "The captain ordered his soldiers to fall back."
        },
        {
           "id": 1597,
           "turkish_word": "sıkıcı",
           "english_word": "boring",
           "type": "adj",
           "turkish_sentence": "Sıkıcı bir insanla uzun süre muhabbet edemem.",
           "english_sentence": "I can’t have a long conversation with a boring person."
        },
        {
           "id": 1598,
           "turkish_word": "kızgın",
           "english_word": "angry, mad",
           "type": "adj",
           "turkish_sentence": "Aptalca davrandığım için bana hala kızgın mısın?",
           "english_sentence": "Are you still angry at me because I acted so stupidly?"
        },
        {
           "id": 1599,
           "turkish_word": "çay",
           "english_word": "tea",
           "type": "n",
           "turkish_sentence": "Çay demledim, bir bardak içmek ister misin?",
           "english_sentence": "I prepared tea ; would you like to drink a cup of it?"
        },
        {
           "id": 1600,
           "turkish_word": "kendin",
           "english_word": "yourself",
           "type": "pron",
           "turkish_sentence": "Kuralları belirlemek istiyorsan, onlara kendin uymak zorunda kalacaksın.",
           "english_sentence": "If you want to set the rules, you'll have to follow them by yourself."
        },
        {
           "id": 1601,
           "turkish_word": "gir",
           "english_word": "enter, get in",
           "type": "v",
           "turkish_sentence": "O seni bekliyor, içeri gir.",
           "english_sentence": "She is waiting for you, get in."
        },
        {
           "id": 1602,
           "turkish_word": "kelime",
           "english_word": "word",
           "type": "n",
           "turkish_sentence": "Onun dediğinin tek bir kelime sini bile anlamadım.",
           "english_sentence": "I didn’t understand one word of what she had said."
        },
        {
           "id": 1603,
           "turkish_word": "zeki",
           "english_word": "smart",
           "type": "adj",
           "turkish_sentence": "Tüm okuldaki en zeki öğrencilerden biri o.",
           "english_sentence": "She is one of the smartest students in the whole school."
        },
        {
           "id": 1604,
           "turkish_word": "karanlık",
           "english_word": "darkness, dark",
           "type": "n",
           "turkish_sentence": "Işıklar söndü ve hol karanlığa gömüldü.",
           "english_sentence": "The lights went out and the hall was plunged into darkness."
        },
        {
           "id": 1605,
           "turkish_word": "vakti",
           "english_word": "it’s time",
           "type": "n",
           "turkish_sentence": "Gitme vakti geldi.",
           "english_sentence": "It’s time to go."
        },
        {
           "id": 1606,
           "turkish_word": "yazık",
           "english_word": "pity/alas",
           "type": "interj",
           "turkish_sentence": "Yazık ! Genç kadın araba kazasında hayatını kaybetti.",
           "english_sentence": "Pity ! The young woman died in a car accident."
        },
        {
           "id": 1607,
           "turkish_word": "tanıyorum",
           "english_word": "I know",
           "type": "v",
           "turkish_sentence": "Türkçe konuşan bir adam tanıyorum.",
           "english_sentence": "I know a man who speaks Turkish."
        },
        {
           "id": 1608,
           "turkish_word": "alıyorum",
           "english_word": "I am getting/taking",
           "type": "v",
           "turkish_sentence": "Bu bilgileri gizli kaynaklardan alıyorum.",
           "english_sentence": "I’m getting this information from secret sources."
        },
        {
           "id": 1609,
           "turkish_word": "olacağız",
           "english_word": "we will be",
           "type": "v",
           "turkish_sentence": "Endişelenme, iyi olacağız.",
           "english_sentence": "Don’t worry, we’ll be fine."
        },
        {
           "id": 1610,
           "turkish_word": "karım",
           "english_word": "my wife",
           "type": "n",
           "turkish_sentence": "Karım et yemekten nefret ediyor, bu yüzden vejetaryen.",
           "english_sentence": "My wife hates eating meat, that’s why she is vegetarian."
        },
        {
           "id": 1611,
           "turkish_word": "tebrikler",
           "english_word": "congratulations",
           "type": "interj",
           "turkish_sentence": "Tebrikler ! Sınavı geçtin.",
           "english_sentence": "Congratulations ! You passed the exam."
        },
        {
           "id": 1612,
           "turkish_word": "albay",
           "english_word": "colonel",
           "type": "n",
           "turkish_sentence": "Kore Savaşı’nda süvari birliğini komuta eden albay kimdi?",
           "english_sentence": "Who was the colonel commanding cavalry in the Korean War?"
        },
        {
           "id": 1613,
           "turkish_word": "Mustafa",
           "english_word": "Mustafa",
           "type": "n",
           "turkish_sentence": "Mustafa bizimle gelmiyor.",
           "english_sentence": "Mustafa is not coming with us.",
           "notes": "masculine name"
        },
        {
           "id": 1614,
           "turkish_word": "başıma",
           "english_word": "at my head",
           "type": "adv",
           "turkish_sentence": "Basketbol oynarken biri topu başıma fırlattı.",
           "english_sentence": "When playing basketball, someone threw the ball at my head."
        },
        {
           "id": 1615,
           "turkish_word": "saçmalık",
           "english_word": "bullshit",
           "type": "n",
           "turkish_sentence": "Saçmalık bu.",
           "english_sentence": "That is bullshit."
        },
        {
           "id": 1616,
           "turkish_word": "koy",
           "english_word": "put",
           "type": "v",
           "turkish_sentence": "Ellerini direksiyonun üzerinde onları görebileceğim bir yere koy.",
           "english_sentence": "Put your hands on the wheel where I can see them."
        },
        {
           "id": 1617,
           "turkish_word": "verdin",
           "english_word": "you gave",
           "type": "v",
           "turkish_sentence": "Bana buraya gelme cesareti verdin.",
           "english_sentence": "You gave me the courage to come over here."
        },
        {
           "id": 1618,
           "turkish_word": "unut",
           "english_word": "forget",
           "type": "v",
           "turkish_sentence": "Lütfen daha önce konuştuklarımızı unut.",
           "english_sentence": "Please forget what we talked about earlier."
        },
        {
           "id": 1619,
           "turkish_word": "kaldım",
           "english_word": "I stayed",
           "type": "v",
           "turkish_sentence": "Ayşe’ye bakmak için bir süre evde kaldım.",
           "english_sentence": "I stayed at home for a while to care for Ayşe."
        },
        {
           "id": 1620,
           "turkish_word": "yapıyorsunuz",
           "english_word": "you",
           "type": "v",
           "turkish_sentence": "Burada ne yapıyorsunuz ?",
           "english_sentence": "What are you doing here?",
           "notes": "plural/formal"
        },
        {
           "id": 1621,
           "turkish_word": "kutsal",
           "english_word": "sacred",
           "type": "adj",
           "turkish_sentence": "Yaşam kutsal bir hediyedir.",
           "english_sentence": "Life is a sacred gift."
        },
        {
           "id": 1622,
           "turkish_word": "yapıyoruz",
           "english_word": "we are/have been doing",
           "type": "v",
           "turkish_sentence": "Bu işi yıllardır yapıyoruz.",
           "english_sentence": "We have been doing this job for years."
        },
        {
           "id": 1623,
           "turkish_word": "duyuyorum",
           "english_word": "I hear/I am hearing",
           "type": "v",
           "turkish_sentence": "Bazen rüyalarımda çığlıklar duyuyorum.",
           "english_sentence": "Sometimes I hear screams in my dreams."
        },
        {
           "id": 1624,
           "turkish_word": "öldürdü",
           "english_word": "he/she killed",
           "type": "n",
           "turkish_sentence": "Ordudayken 10 kişiyi öldürdü.",
           "english_sentence": "He killed 10 people when he was in the army."
        },
        {
           "id": 1625,
           "turkish_word": "ray",
           "english_word": "rail",
           "type": "n",
           "turkish_sentence": "Tren dağlık bir bölgede ray dan çıktı.",
           "english_sentence": "The train came off the rails in a mountainous area."
        },
        {
           "id": 1626,
           "turkish_word": "hayatı",
           "english_word": "his/her life",
           "type": "n",
           "turkish_sentence": "Polis onun hayatı nı kurtardı.",
           "english_sentence": "The policeman saved her life."
        },
        {
           "id": 1627,
           "turkish_word": "kadının",
           "english_word": "woman’s",
           "type": "poss",
           "turkish_sentence": "Kadının kocası, onu uzun zaman önce terketti.",
           "english_sentence": "The woman’s husband left her a long time ago."
        },
        {
           "id": 1628,
           "turkish_word": "hikaye",
           "english_word": "story",
           "type": "n",
           "turkish_sentence": "Bu hikaye kulağa tuhaf gelebilir ama tamamen gerçek.",
           "english_sentence": "This story may sound strange, but it's absolutely true."
        },
        {
           "id": 1629,
           "turkish_word": "geriye",
           "english_word": "backwards",
           "type": "adv",
           "turkish_sentence": "Derin nefes al ve 50’den geriye say.",
           "english_sentence": "Take a deep breath and count backwards from 50."
        },
        {
           "id": 1630,
           "turkish_word": "söyleyeceğim",
           "english_word": "I will tell",
           "type": "v",
           "turkish_sentence": "Hazır olduğumda sana söyleyeceğim.",
           "english_sentence": "I will tell you when I am ready."
        },
        {
           "id": 1631,
           "turkish_word": "birazdan",
           "english_word": "shortly",
           "type": "adv",
           "turkish_sentence": "Tren birazdan istasyona varacak.",
           "english_sentence": "The train will arrive at the station shortly."
        },
        {
           "id": 1632,
           "turkish_word": "defol",
           "english_word": "get lost",
           "type": "interj",
           "turkish_sentence": "Yüzünü görmek istemiyorum. Defol !",
           "english_sentence": "I don’t want to see your face. Get lost !"
        },
        {
           "id": 1633,
           "turkish_word": "şanslı",
           "english_word": "lucky",
           "type": "adj",
           "turkish_sentence": "Çok şanslı olmalı. Piyangoyu iki kere kazandı.",
           "english_sentence": "He must be very lucky. He won the lottery twice."
        },
        {
           "id": 1634,
           "turkish_word": "suçlu",
           "english_word": "guilty",
           "type": "adj",
           "turkish_sentence": "Herkes onun masum olduğunu biliyordu, ama mahkeme onu suçlu buldu.",
           "english_sentence": "Everyone knew that he was innocent, but the court found him guilty."
        },
        {
           "id": 1635,
           "turkish_word": "tamamdır",
           "english_word": "okay, all right",
           "type": "interj",
           "turkish_sentence": "Tamamdır, hadi gidelim.",
           "english_sentence": "All right, let’s go."
        },
        {
           "id": 1636,
           "turkish_word": "yuh",
           "english_word": "shit",
           "type": "interj",
           "turkish_sentence": "Yuh ! Bu araba çok pahalı.",
           "english_sentence": "Shit ! This car is very expensive.",
           "notes": "curse"
        },
        {
           "id": 1637,
           "turkish_word": "hoşuna",
           "english_word": "to like",
           "type": "v",
           "turkish_sentence": "Anlattıkların onun hoşuna git medi.",
           "english_sentence": "He didn’t like what you talked about.",
           "notes": "used in a form of hoşuna + gitmek"
        },
        {
           "id": 1638,
           "turkish_word": "saygı",
           "english_word": "respect",
           "type": "n",
           "turkish_sentence": "Bana biraz saygı göster, ben senin babanım.",
           "english_sentence": "Show me some respect, I’m your father."
        },
        {
           "id": 1639,
           "turkish_word": "yapmadım",
           "english_word": "I didn’t do",
           "type": "v",
           "turkish_sentence": "Onu mutlu etmek için hiçbir şey yapmadım.",
           "english_sentence": "I didn’t do anything to make her happy."
        },
        {
           "id": 1640,
           "turkish_word": "edelim",
           "english_word": "let’s do/perform",
           "type": "aux",
           "turkish_sentence": "Hadi dans edelim.",
           "english_sentence": "Let’s dance.",
           "notes": "auxilary verb used with nouns"
        },
        {
           "id": 1641,
           "turkish_word": "sizden",
           "english_word": "from you; than you",
           "type": "adv",
           "turkish_sentence": "Kız kardeşiniz sizden daha güzel.",
           "english_sentence": "Your sister is more beautiful than you."
        },
        {
           "id": 1642,
           "turkish_word": "almış",
           "english_word": "he/she had taken",
           "type": "v",
           "turkish_sentence": "Cebimdeki bütün parayı almış.",
           "english_sentence": "He had taken all the money in my pocket."
        },
        {
           "id": 1643,
           "turkish_word": "hayatım",
           "english_word": "my life",
           "type": "n",
           "turkish_sentence": "Hayatım ı kurtardın, sana borçluyum.",
           "english_sentence": "You saved my life, I owe you."
        },
        {
           "id": 1644,
           "turkish_word": "sürece",
           "english_word": "as long as",
           "type": "conj",
           "turkish_sentence": "Beni sevdiğin sürece yanında olacağım.",
           "english_sentence": "I will stay with you as long as you love me."
        },
        {
           "id": 1645,
           "turkish_word": "çift",
           "english_word": "couple, pair",
           "type": "n",
           "turkish_sentence": "Eş cinsel çift ler bazı Avrupa ülkelerinde evlenebiliyor.",
           "english_sentence": "Same-sex couples can get married in some European countries."
        },
        {
           "id": 1646,
           "turkish_word": "olmak",
           "english_word": "to be",
           "type": "v",
           "turkish_sentence": "Hep diş hekimi olma yı istedim.",
           "english_sentence": "I always wanted to be a dentist."
        },
        {
           "id": 1647,
           "turkish_word": "çıkıp",
           "english_word": "walk out",
           "type": "ptcp",
           "turkish_sentence": "Tek başıma evden çıkıp gittim.",
           "english_sentence": "I walked out of the house on my own."
        },
        {
           "id": 1648,
           "turkish_word": "Ahmet",
           "english_word": "Ahmet",
           "type": "n",
           "turkish_sentence": "Ahmet benimle gelmek istedi.",
           "english_sentence": "Ahmet wanted to come with me.",
           "notes": "masculine name"
        },
        {
           "id": 1649,
           "turkish_word": "hediye",
           "english_word": "gift",
           "type": "n",
           "turkish_sentence": "Tüm günü internette hediye aramakla geçirdi.",
           "english_sentence": "She spent whole day searching on the web for a gift to buy."
        },
        {
           "id": 1650,
           "turkish_word": "ikinci",
           "english_word": "second",
           "type": "adj",
           "turkish_sentence": "Hayat her zaman ikinci bir şans vermez.",
           "english_sentence": "Life doesn’t always give a second chance."
        },
        {
           "id": 1651,
           "turkish_word": "kişisel",
           "english_word": "personal",
           "type": "adj",
           "turkish_sentence": "Bu hizmeti kullanmak için kişisel bilgilerini vermen gerekiyor.",
           "english_sentence": "You need to provide your personal information to use this service."
        },
        {
           "id": 1652,
           "turkish_word": "gördüğüm",
           "english_word": "that I have seen",
           "type": "ptcp",
           "turkish_sentence": "Gördüğüm en yakışıklı erkeksin.",
           "english_sentence": "You are the most handsome man that I have ever seen."
        },
        {
           "id": 1653,
           "turkish_word": "ikna",
           "english_word": "persuasion",
           "type": "n",
           "turkish_sentence": "Her yolu denedik. ikna, rüşvet, tehdit… İşe yaramadı.",
           "english_sentence": "We tried everything. Persuasion, bribery, threat... It didn’t work out."
        },
        {
           "id": 1654,
           "turkish_word": "yolu",
           "english_word": "a way to",
           "type": "n",
           "turkish_sentence": "Onu konuşturmanın bir yolu nu bulmamız gerek.",
           "english_sentence": "We need to find a way to make him talk."
        },
        {
           "id": 1655,
           "turkish_word": "farkında",
           "english_word": "aware",
           "type": "adj",
           "turkish_sentence": "Annesinin hasta olduğunun farkında değildi.",
           "english_sentence": "He wasn’t aware that his mother was sick."
        },
        {
           "id": 1656,
           "turkish_word": "endişelenme",
           "english_word": "don’t worry",
           "type": "interj",
           "turkish_sentence": "Endişelenme. Her şey çok güzel olacak.",
           "english_sentence": "Don’t worry. Everything will be fine."
        },
        {
           "id": 1657,
           "turkish_word": "ee",
           "english_word": "so",
           "type": "interj",
           "turkish_sentence": "Ee, yani?",
           "english_sentence": "So what?"
        },
        {
           "id": 1658,
           "turkish_word": "annesi",
           "english_word": "his/her mom",
           "type": "n",
           "turkish_sentence": "Annesi, Kadir’in Miami’ye gitmesini istiyor.",
           "english_sentence": "His mom wants Kadir to go to Miami."
        },
        {
           "id": 1659,
           "turkish_word": "götür",
           "english_word": "take",
           "type": "v",
           "turkish_sentence": "Çok kötü hissediyorum, beni eve götür lütfen",
           "english_sentence": "I feel so bad, take me home please."
        },
        {
           "id": 1660,
           "turkish_word": "gerekecek",
           "english_word": "he/she/it will have to",
           "type": "v",
           "turkish_sentence": "İşin yarın sabaha kadar bitmiş olması gerekecek.",
           "english_sentence": "The job will have to be done by tomorrow morning."
        },
        {
           "id": 1661,
           "turkish_word": "söyleyin",
           "english_word": "tell",
           "type": "v",
           "turkish_sentence": "Bayım, lütfen bana onun nerede olduğunu söyleyin.",
           "english_sentence": "Sir, please tell me where he is."
        },
        {
           "id": 1662,
           "turkish_word": "söyler",
           "english_word": "he/she tells",
           "type": "v",
           "turkish_sentence": "Öğretmenimiz bize her zaman iyi bir vatandaş olmamızı söyler.",
           "english_sentence": "Our teacher always tells us to be a good citizen."
        },
        {
           "id": 1663,
           "turkish_word": "balık",
           "english_word": "fish",
           "type": "n",
           "turkish_sentence": "Balık yemek için Eminönü’ne gidelim.",
           "english_sentence": "Let’s go to Eminönü to eat some fish."
        },
        {
           "id": 1664,
           "turkish_word": "ilgisi",
           "english_word": "his/her interest",
           "type": "n",
           "turkish_sentence": "Bazı insanların paraya ve mücevherata hiç ilgisi yoktur.",
           "english_sentence": "Some people have no interest in money and jewelry at all."
        },
        {
           "id": 1665,
           "turkish_word": "biliyorsunuz",
           "english_word": "you know",
           "type": "v",
           "turkish_sentence": "Ailemle sorunlar yaşadığımı biliyorsunuz.",
           "english_sentence": "You know that I’m having problems with my family."
        },
        {
           "id": 1666,
           "turkish_word": "hayatın",
           "english_word": "your life; of life",
           "type": "n",
           "turkish_sentence": "Bu iş, hayatın ı değiştirebilir.",
           "english_sentence": "This job may change your life."
        },
        {
           "id": 1667,
           "turkish_word": "bölüm",
           "english_word": "section",
           "type": "n",
           "turkish_sentence": "Senaryonun son bölüm ünü sevdin mi?",
           "english_sentence": "Did you like the last section of the script?"
        },
        {
           "id": 1668,
           "turkish_word": "yüce",
           "english_word": "supreme",
           "type": "adj",
           "turkish_sentence": "Yüce Divan kararını yarın açıklayacak.",
           "english_sentence": "The Supreme Court will announce their decision tomorrow."
        },
        {
           "id": 1669,
           "turkish_word": "Hüseyin",
           "english_word": "Hüseyin",
           "type": "n",
           "turkish_sentence": "Hüseyin oyun bilgisayarı için yeni bir klavye aldı.",
           "english_sentence": "Hüseyin bought a new keyboard for his gaming computer.",
           "notes": "masculine name"
        },
        {
           "id": 1670,
           "turkish_word": "duruyor",
           "english_word": "standing",
           "type": "v",
           "turkish_sentence": "Kapı eşiğinde duruyor sun.",
           "english_sentence": "You are standing in the doorway."
        },
        {
           "id": 1671,
           "turkish_word": "gitme",
           "english_word": "don’t go",
           "type": "v",
           "turkish_sentence": "Bugün spor salonuna gitme, birlikte eğlenelim.",
           "english_sentence": "Don’t go to the gym today, let’s have some fun together."
        },
        {
           "id": 1672,
           "turkish_word": "arabaya",
           "english_word": "to the car",
           "type": "n",
           "turkish_sentence": "Hava çok soğuktu, montumu almak için arabaya gittim.",
           "english_sentence": "It was so cold, I went to the car to get my jacket."
        },
        {
           "id": 1673,
           "turkish_word": "güvende",
           "english_word": "safe",
           "type": "adj",
           "turkish_sentence": "Burada güvende sin.",
           "english_sentence": "You are safe here."
        },
        {
           "id": 1674,
           "turkish_word": "verme",
           "english_word": "don’t give",
           "type": "v",
           "turkish_sentence": "Bana o silahı verme, bunu yapmak istemiyorum.",
           "english_sentence": "Don’t give me that gun, I don’t want to do this."
        },
        {
           "id": 1675,
           "turkish_word": "hanımefendi",
           "english_word": "ma’am, lady",
           "type": "n",
           "turkish_sentence": "Üzgünüm hanımefendi. Şu an çok meşgulüm.",
           "english_sentence": "I’m sorry ma’am. I am very busy right now."
        },
        {
           "id": 1676,
           "turkish_word": "seksi",
           "english_word": "sexy",
           "type": "adv",
           "turkish_sentence": "Uzun saçla seksi görünüyor.",
           "english_sentence": "She looks sexy with long hair."
        },
        {
           "id": 1677,
           "turkish_word": "kalmadı",
           "english_word": "no left",
           "type": "v",
           "turkish_sentence": "Zaman kalmadı.",
           "english_sentence": "There is no time left."
        },
        {
           "id": 1678,
           "turkish_word": "iyidir",
           "english_word": "it’s good",
           "type": "adv",
           "turkish_sentence": "O iyi diyorsa, iyidir.",
           "english_sentence": "If she says it’s good, then it’s good."
        },
        {
           "id": 1679,
           "turkish_word": "gideceğim",
           "english_word": "I will/am going to go",
           "type": "v",
           "turkish_sentence": "Kalbimi kırarsan gideceğim ve asla geri dönmeyeceğim.",
           "english_sentence": "If you break my heart, I will go away and never come back."
        },
        {
           "id": 1680,
           "turkish_word": "Zeynep",
           "english_word": "Zeynep",
           "type": "n",
           "turkish_sentence": "Zeynep kilo vermeye çalışıyor.",
           "english_sentence": "Zeynep is trying to lose weight.",
           "notes": "feminine name"
        },
        {
           "id": 1681,
           "turkish_word": "maks",
           "english_word": "maximum",
           "type": "adj",
           "turkish_sentence": "Ali maksimum güvenlikli bir tesiste ömür boyu hapis cezasını çekiyordu.",
           "english_sentence": "Ali was serving a life sentence in a maximum- security facility.",
           "notes": "abbreviation of “maksimum”"
        },
        {
           "id": 1682,
           "turkish_word": "döndü",
           "english_word": "he/she/it came back",
           "type": "v",
           "turkish_sentence": "Savaş bittikten sonra eve döndü.",
           "english_sentence": "He came back home after the war finished."
        },
        {
           "id": 1683,
           "turkish_word": "park",
           "english_word": "park",
           "type": "n",
           "turkish_sentence": "Park, şehir merkezinde yer alıyor.",
           "english_sentence": "The park is located in the center of the city."
        },
        {
           "id": 1684,
           "turkish_word": "erkekler",
           "english_word": "men, males",
           "type": "n",
           "turkish_sentence": "Bazı kültürlerde, erkekler kadınların onlarla eşit olmadığını düşünür.",
           "english_sentence": "In some cultures, men think that women are not equal to them."
        },
        {
           "id": 1685,
           "turkish_word": "kalacak",
           "english_word": "to stay",
           "type": "adj",
           "turkish_sentence": "Kalacak otel bulamadık.",
           "english_sentence": "We couldn’t find a hotel to stay in."
        },
        {
           "id": 1686,
           "turkish_word": "tehdit",
           "english_word": "threat",
           "type": "n",
           "turkish_sentence": "Duruşma süresince bir sürü ölüm tehdid ine maruz kaldık.",
           "english_sentence": "We were exposed to a lot of death threats at the time of the trial."
        },
        {
           "id": 1687,
           "turkish_word": "olduğumuzu",
           "english_word": "that we are",
           "type": "ptcp",
           "turkish_sentence": "Birlikte daha güçlü olduğumuzu unutma.",
           "english_sentence": "Don’t forget that we are stronger together."
        },
        {
           "id": 1688,
           "turkish_word": "Yusuf",
           "english_word": "Yusuf",
           "type": "n",
           "turkish_sentence": "Yusuf kuzeninin evine gitti.",
           "english_sentence": "Yusuf went to his cousin’s home.",
           "notes": "masculine name"
        },
        {
           "id": 1689,
           "turkish_word": "arıyor",
           "english_word": "calling; looking for",
           "type": "v",
           "turkish_sentence": "Telefonu aç, seni arıyor um.",
           "english_sentence": "Pick up the phone, I’m calling you."
        },
        {
           "id": 1690,
           "turkish_word": "korkarım",
           "english_word": "I’m afraid",
           "type": "adv",
           "turkish_sentence": "Korkarım başka seçeneğimiz yok.",
           "english_sentence": "I’m afraid we have no other choice."
        },
        {
           "id": 1691,
           "turkish_word": "buralarda",
           "english_word": "hereabouts",
           "type": "adv",
           "turkish_sentence": "Buralarda çok fazla vahşi kedi var.",
           "english_sentence": "There are many wild cats hereabouts."
        },
        {
           "id": 1692,
           "turkish_word": "çalıştım",
           "english_word": "I worked",
           "type": "v",
           "turkish_sentence": "Üniversitedeyken garson olarak çalıştım.",
           "english_sentence": "I worked as a waiter when I was in college."
        },
        {
           "id": 1693,
           "turkish_word": "ayak",
           "english_word": "foot",
           "type": "n",
           "turkish_sentence": "Ayağı nda küçük bir dövme var.",
           "english_sentence": "She has a small tattoo on her foot."
        },
        {
           "id": 1694,
           "turkish_word": "kirli",
           "english_word": "dirty",
           "type": "adj",
           "turkish_sentence": "Kirli çamaşırlarını temizletmek istiyorsan bana haber ver.",
           "english_sentence": "Let me know if you want to get your dirty clothes cleaned."
        },
        {
           "id": 1695,
           "turkish_word": "yardıma",
           "english_word": "to/for help",
           "type": "n",
           "turkish_sentence": "Kazanın hemen ardından ona yardıma koştuk.",
           "english_sentence": "We rushed to help him right after the accident."
        },
        {
           "id": 1696,
           "turkish_word": "gitmiş",
           "english_word": "he/she went",
           "type": "v",
           "turkish_sentence": "Pazar sabahı kiliseye gitmiş.",
           "english_sentence": "She went to the church on Sunday morning."
        },
        {
           "id": 1697,
           "turkish_word": "verecek",
           "english_word": "he/she will give",
           "type": "v",
           "turkish_sentence": "Tüm parasını bana verecek.",
           "english_sentence": "He will give me all his money."
        },
        {
           "id": 1698,
           "turkish_word": "sesi",
           "english_word": "voice of",
           "type": "n",
           "turkish_sentence": "Halkın sesi göz ardı edilemez.",
           "english_sentence": "The voice of the people shall not be ignored."
        },
        {
           "id": 1699,
           "turkish_word": "yaşamak",
           "english_word": "to live",
           "type": "v",
           "turkish_sentence": "Kuzenleriyle yaşamak için küçük bir kasabaya taşındı.",
           "english_sentence": "He moved to a small town to live with his cousins."
        },
        {
           "id": 1700,
           "turkish_word": "yoldan",
           "english_word": "off the road",
           "type": "adv",
           "turkish_sentence": "Araba yoldan çıkıp dereye düştü.",
           "english_sentence": "The car went off the road into the creek."
        },
        {
           "id": 1701,
           "turkish_word": "çıkmak",
           "english_word": "to get out, to exit",
           "type": "v",
           "turkish_sentence": "Buradan çıkmak istiyorsak bir planımız olmalı.",
           "english_sentence": "We need to have a plan if we want to get out of here."
        },
        {
           "id": 1702,
           "turkish_word": "insan",
           "english_word": "human",
           "type": "n",
           "turkish_sentence": "İnsan hakları üzerine kısa bir tartışmamız oldu.",
           "english_sentence": "We had a brief discussion about human rights."
        },
        {
           "id": 1703,
           "turkish_word": "hoşça kal",
           "english_word": "goodbye",
           "type": "inter",
           "turkish_sentence": "Hoşça kal dostum!",
           "english_sentence": "Goodbye my friend!"
        },
        {
           "id": 1704,
           "turkish_word": "polisi",
           "english_word": "the police",
           "type": "n",
           "turkish_sentence": "İçeride birisi var, polisi ara!",
           "english_sentence": "There is someone inside, call the police !"
        },
        {
           "id": 1705,
           "turkish_word": "okula",
           "english_word": "to school",
           "type": "adv",
           "turkish_sentence": "Fatih’in annesi onu okula bıraktı.",
           "english_sentence": "Fatih’s mother brought him to school."
        },
        {
           "id": 1706,
           "turkish_word": "yiyecek",
           "english_word": "food",
           "type": "n",
           "turkish_sentence": "Kebap, Türkiye’nin en popüler yiyecek lerinden biridir.",
           "english_sentence": "Kebab is one of the most popular foods in Turkey."
        },
        {
           "id": 1707,
           "turkish_word": "inanılmaz",
           "english_word": "incredible",
           "type": "adj",
           "turkish_sentence": "Hayat inanılmaz.",
           "english_sentence": "Life is incredible."
        },
        {
           "id": 1708,
           "turkish_word": "arıyorum",
           "english_word": "I’m looking for/calling",
           "type": "v",
           "turkish_sentence": "Beni sonsuza kadar sevecek bir kadın arıyorum.",
           "english_sentence": "I’m looking for a woman to love me forever."
        },
        {
           "id": 1709,
           "turkish_word": "alacak",
           "english_word": "will take",
           "type": "v",
           "turkish_sentence": "Bu iş çok vakit alacak.",
           "english_sentence": "This job will take so much time."
        },
        {
           "id": 1710,
           "turkish_word": "kulak",
           "english_word": "ear",
           "type": "n",
           "turkish_sentence": "Sevdiğimiz kişilerin sesini duyduğumuzda kulak larımız bunu hisseder.",
           "english_sentence": "Our ears sense it when we hear the voices of dear ones."
        },
        {
           "id": 1711,
           "turkish_word": "mantıklı",
           "english_word": "sensible",
           "type": "adj",
           "turkish_sentence": "O çok mantıklı biri. Bu yüzden birbirimizle asla tartışmayız.",
           "english_sentence": "He is a very sensible guy. That’s why we never argue with each other."
        },
        {
           "id": 1712,
           "turkish_word": "şuraya",
           "english_word": "right there",
           "type": "adv",
           "turkish_sentence": "Şuraya başka bir kutu koyun.",
           "english_sentence": "Put another box right there."
        },
        {
           "id": 1713,
           "turkish_word": "kafa",
           "english_word": "head",
           "type": "n",
           "turkish_sentence": "Milli sporcumuz kafa sını çarptı ve hafızasını kaybetti.",
           "english_sentence": "Our national athlete hit his head and lost his memory."
        },
        {
           "id": 1714,
           "turkish_word": "bilmiyorsun",
           "english_word": "you don’t know",
           "type": "v",
           "turkish_sentence": "Onun adını bilmiyorsun, değil mi?",
           "english_sentence": "You don’t know his name, do you?"
        },
        {
           "id": 1715,
           "turkish_word": "Murat",
           "english_word": "Murat",
           "type": "n",
           "turkish_sentence": "Murat müdürlüğe terfi etti.",
           "english_sentence": "Murat was promoted to manager.",
           "notes": "masculine name"
        },
        {
           "id": 1716,
           "turkish_word": "bildiğim",
           "english_word": "that I know",
           "type": "ptcp",
           "turkish_sentence": "Bu hayvan, bildiğim diğer tüm hayvanlardan daha farklı.",
           "english_sentence": "This animal is different than all other animals that I know."
        },
        {
           "id": 1717,
           "turkish_word": "ayağa",
           "english_word": "up",
           "type": "adv",
           "turkish_sentence": "Kral, adamlarına ayağa kalkmalarını emretti.",
           "english_sentence": "The king has commanded his men to stand up."
        },
        {
           "id": 1718,
           "turkish_word": "etmez",
           "english_word": "he/she doesn’t do/perform",
           "type": "aux",
           "turkish_sentence": "Onu tanıdığım kadarıyla fakirlere yardım etmez.",
           "english_sentence": "As far as I know him, he doesn’t help the poor.",
           "notes": "auxilary verb used with nouns"
        },
        {
           "id": 1719,
           "turkish_word": "önceden",
           "english_word": "before",
           "type": "adv",
           "turkish_sentence": "Bu sesi önceden duymuştum.",
           "english_sentence": "I have heard that voice before."
        },
        {
           "id": 1720,
           "turkish_word": "Ömer",
           "english_word": "Ömer",
           "type": "n",
           "turkish_sentence": "Ailemizde interneti en çok Ömer kullanıyor.",
           "english_sentence": "Ömer uses the internet most in our family.",
           "notes": "masculine name"
        },
        {
           "id": 1721,
           "turkish_word": "olurum",
           "english_word": "I would be",
           "type": "v",
           "turkish_sentence": "Bize katılırsan mutlu olurum.",
           "english_sentence": "I would be happy if you join us."
        },
        {
           "id": 1722,
           "turkish_word": "tarafta",
           "english_word": "at the side",
           "type": "adv",
           "turkish_sentence": "Lokantamız kasabanın diğer tarafında bulunuyor.",
           "english_sentence": "Our restaurant is located at the other side of the town."
        },
        {
           "id": 1723,
           "turkish_word": "kadını",
           "english_word": "the woman",
           "type": "n",
           "turkish_sentence": "Kadını sokakta gördüm.",
           "english_sentence": "I saw the woman on the street."
        },
        {
           "id": 1724,
           "turkish_word": "muydu",
           "english_word": "was/did",
           "type": "interr",
           "turkish_sentence": "Ailen yalan söylediğini biliyor muydu ?",
           "english_sentence": "Did your family know that you were lying?"
        },
        {
           "id": 1725,
           "turkish_word": "dene",
           "english_word": "try",
           "type": "v",
           "turkish_sentence": "Aldığın elbiseyi dene.",
           "english_sentence": "Try on the dress you just bought."
        },
        {
           "id": 1726,
           "turkish_word": "Teğmen",
           "english_word": "lieutenant",
           "type": "n",
           "turkish_sentence": "Teğmen Yılmaz, olay yerine bir ekip gönderdi.",
           "english_sentence": "Lieutenant Yılmaz sent a team to the crime scene."
        },
        {
           "id": 1727,
           "turkish_word": "Berat",
           "english_word": "Berat",
           "type": "n",
           "turkish_sentence": "Berat dün işe geç kaldı.",
           "english_sentence": "Berat was late for work yesterday.",
           "notes": "masculine name"
        },
        {
           "id": 1728,
           "turkish_word": "yaptık",
           "english_word": "we did",
           "type": "v",
           "turkish_sentence": "Sınıf arkadaşlarımızla birlikte ödevimizi yaptık.",
           "english_sentence": "We did our homework with our classmates."
        },
        {
           "id": 1729,
           "turkish_word": "nesi",
           "english_word": "what",
           "type": "pron",
           "turkish_sentence": "Kızın nesi var?",
           "english_sentence": "What ’s wrong with the girl?"
        },
        {
           "id": 1730,
           "turkish_word": "geldiğinde",
           "english_word": "when you/he/she/it come",
           "type": "adv",
           "turkish_sentence": "Geri geldiğinde onu bekliyor olacaklar.",
           "english_sentence": "They will be waiting for him when he comes back."
        },
        {
           "id": 1731,
           "turkish_word": "ikiniz",
           "english_word": "you two",
           "type": "pron",
           "turkish_sentence": "Siz ikiniz sıraya geçin!",
           "english_sentence": "You two get in the line!"
        },
        {
           "id": 1732,
           "turkish_word": "istersin",
           "english_word": "you would want",
           "type": "v",
           "turkish_sentence": "Bu lezzetli yemeği tadarsan eminim daha fazlasını yemek istersin.",
           "english_sentence": "If you try this delicious food, I am sure you would want to eat more."
        },
        {
           "id": 1733,
           "turkish_word": "zorundasın",
           "english_word": "you have to",
           "type": "v",
           "turkish_sentence": "Sınavı geçmek istiyorsan çok çalışmak zorundasın.",
           "english_sentence": "If you want to pass the exam, you have to work hard."
        },
        {
           "id": 1734,
           "turkish_word": "Kerem",
           "english_word": "Kerem",
           "type": "n",
           "turkish_sentence": "Benim en iyi arkadaşlarımdan biri Kerem.",
           "english_sentence": "Kerem is one of my best friends.",
           "notes": "masculine name"
        },
        {
           "id": 1735,
           "turkish_word": "zamanlarda",
           "english_word": "at times",
           "type": "adv",
           "turkish_sentence": "Böyle zor zamanlarda birbirimize destek olmalıyız.",
           "english_sentence": "We should support each other at such hard times."
        },
        {
           "id": 1736,
           "turkish_word": "istediğimi",
           "english_word": "that I want",
           "type": "ptcp",
           "turkish_sentence": "Onun mutlu olmasını istediğimi söyledim.",
           "english_sentence": "I told her that I want her to be happy."
        },
        {
           "id": 1737,
           "turkish_word": "gördünüz",
           "english_word": "you saw",
           "type": "v",
           "turkish_sentence": "Katilin kim olduğunu biliyorsunuz. Onu gördünüz.",
           "english_sentence": "You know who the murderer is. You saw him."
        },
        {
           "id": 1738,
           "turkish_word": "şanslar",
           "english_word": "luck",
           "type": "n",
           "turkish_sentence": "İyi şanslar !",
           "english_sentence": "Good luck !"
        },
        {
           "id": 1739,
           "turkish_word": "açın",
           "english_word": "open",
           "type": "v",
           "turkish_sentence": "Lütfen kapıyı açın, anahtarlarım yok.",
           "english_sentence": "Please open the door, I don’t have keys."
        },
        {
           "id": 1740,
           "turkish_word": "test",
           "english_word": "test",
           "type": "n",
           "turkish_sentence": "Seni işe almadan önce test yapmamız gerek.",
           "english_sentence": "We need to do a test before hiring you for the job."
        },
        {
           "id": 1741,
           "turkish_word": "eee",
           "english_word": "so",
           "type": "interj",
           "turkish_sentence": "Eee, sonra ne oldu?",
           "english_sentence": "So, what happened?"
        },
        {
           "id": 1742,
           "turkish_word": "yaramaz",
           "english_word": "naughty",
           "type": "adj",
           "turkish_sentence": "Yaramaz bir çocuk olduğum için annem bana bağırırdı.",
           "english_sentence": "My mom used to yell at me because I was a naughty kid."
        },
        {
           "id": 1743,
           "turkish_word": "değil",
           "english_word": "not",
           "type": "adv",
           "turkish_sentence": "Yalnız değil.",
           "english_sentence": "He is not alone."
        },
        {
           "id": 1744,
           "turkish_word": "korumak",
           "english_word": "to protect",
           "type": "v",
           "turkish_sentence": "Seni ve ailemi korumak için buradayım.",
           "english_sentence": "I am here to protect you and my family."
        },
        {
           "id": 1745,
           "turkish_word": "müthiş",
           "english_word": "great",
           "type": "adj",
           "turkish_sentence": "Müthiş bir öğretmendi.",
           "english_sentence": "She was a great teacher."
        },
        {
           "id": 1746,
           "turkish_word": "Emir",
           "english_word": "Emir",
           "type": "n",
           "turkish_sentence": "Emir az önce baba olacağını öğrendi.",
           "english_sentence": "Emir just found out that he is going to be a father.",
           "notes": "masculine name"
        },
        {
           "id": 1747,
           "turkish_word": "ciddiyim",
           "english_word": "I’m serious",
           "type": "interj",
           "turkish_sentence": "Ciddiyim, şaka yapmıyorum.",
           "english_sentence": "I’m serious, I’m not kidding."
        },
        {
           "id": 1748,
           "turkish_word": "buydu",
           "english_word": "that was",
           "type": "v",
           "turkish_sentence": "Bana inanmasını sağlamanın tek yolu buydu.",
           "english_sentence": "That was the only way to make him believe me."
        },
        {
           "id": 1749,
           "turkish_word": "dünyayı",
           "english_word": "the world",
           "type": "n",
           "turkish_sentence": "Birlikte dünyayı dolaştık.",
           "english_sentence": "We traveled around the world together."
        },
        {
           "id": 1750,
           "turkish_word": "kaza",
           "english_word": "accident",
           "type": "n",
           "turkish_sentence": "Polisler kaza mahallinde bir kadın cesedi buldular.",
           "english_sentence": "Cops found a woman’s body at the scene of the accident."
        },
        {
           "id": 1751,
           "turkish_word": "yapabilirsin",
           "english_word": "you can do",
           "type": "v",
           "turkish_sentence": "Vazgeçme, yapabilirsin.",
           "english_sentence": "Don’t give up, you can do it."
        },
        {
           "id": 1752,
           "turkish_word": "istediği",
           "english_word": "that he /she wanted",
           "type": "ptcp",
           "turkish_sentence": "Sonunda istediği elbiseyi aldı.",
           "english_sentence": "She finally bought the dress that she wanted."
        },
        {
           "id": 1753,
           "turkish_word": "olanlar",
           "english_word": "what happened",
           "type": "n",
           "turkish_sentence": "Dün gece olanlar ı anlamaya çalışıyoruz.",
           "english_sentence": "We are trying to figure out what happened last night."
        },
        {
           "id": 1754,
           "turkish_word": "yapman",
           "english_word": "you to do",
           "type": "n",
           "turkish_sentence": "Böyle bir şey yapman ı istemiyorum.",
           "english_sentence": "I don’t want you to do such a thing."
        },
        {
           "id": 1755,
           "turkish_word": "yolda",
           "english_word": "on the road",
           "type": "adv",
           "turkish_sentence": "Yolda geyikler görebilirsin.",
           "english_sentence": "You are likely to see deer on the road."
        },
        {
           "id": 1756,
           "turkish_word": "Elif",
           "english_word": "Elif",
           "type": "n",
           "turkish_sentence": "Elif boşanmak istiyor.",
           "english_sentence": "Elif wants a divorce.",
           "notes": "feminine name"
        },
        {
           "id": 1757,
           "turkish_word": "sıradan",
           "english_word": "ordinary",
           "type": "adj",
           "turkish_sentence": "Sıradan insanlar silah kullanmayı bilmezler.",
           "english_sentence": "Ordinary people don’t know how to use guns."
        },
        {
           "id": 1758,
           "turkish_word": "yanımda",
           "english_word": "next to me ; with me",
           "type": "adv",
           "turkish_sentence": "Cüzdanım yanımda değil.",
           "english_sentence": "I don’t have my wallet with me."
        },
        {
           "id": 1759,
           "turkish_word": "vur",
           "english_word": "hit",
           "type": "v",
           "turkish_sentence": "Hadi dövüşelim ama sert vur, tamam mı?",
           "english_sentence": "Let’s spar but hit hard, okay?"
        },
        {
           "id": 1760,
           "turkish_word": "babanın",
           "english_word": "your father’s",
           "type": "poss",
           "turkish_sentence": "Babanın yeni eşinin ismi ne?",
           "english_sentence": "What’s the name of your father’s new wife?"
        },
        {
           "id": 1761,
           "turkish_word": "Paris",
           "english_word": "Paris",
           "type": "n",
           "turkish_sentence": "Balayı için Paris ’e gittiler.",
           "english_sentence": "They went to Paris for the honeymoon."
        },
        {
           "id": 1762,
           "turkish_word": "yoluna",
           "english_word": "the way",
           "type": "adv",
           "turkish_sentence": "Burası çıkış yoluna benzemiyor.",
           "english_sentence": "This doesn't look like the way out."
        },
        {
           "id": 1763,
           "turkish_word": "asker",
           "english_word": "soldier",
           "type": "n",
           "turkish_sentence": "Her Türk asker doğar.",
           "english_sentence": "Every Turk is born a soldier."
        },
        {
           "id": 1764,
           "turkish_word": "yerden",
           "english_word": "off the floor",
           "type": "adv",
           "turkish_sentence": "Babam kırık bardağı yerden aldı.",
           "english_sentence": "My father took the broken glass off the floor."
        },
        {
           "id": 1765,
           "turkish_word": "sahi",
           "english_word": "really",
           "type": "adv",
           "turkish_sentence": "Sahi mi?",
           "english_sentence": "Really ?"
        },
        {
           "id": 1766,
           "turkish_word": "affedersiniz",
           "english_word": "excuse me",
           "type": "interj",
           "turkish_sentence": "Affedersiniz, Taksim’e nasıl gidebilirim?",
           "english_sentence": "Excuse me, how can I go to Taksim?"
        },
        {
           "id": 1767,
           "turkish_word": "parmak",
           "english_word": "finger",
           "type": "n",
           "turkish_sentence": "Kazada parmak larını kaybetti.",
           "english_sentence": "He lost his finger s in the accident."
        },
        {
           "id": 1768,
           "turkish_word": "aradı",
           "english_word": "he/she called",
           "type": "v",
           "turkish_sentence": "Dün gece beni aradı ve gelmemi istedi.",
           "english_sentence": "She called me last night and asked me to come over."
        },
        {
           "id": 1769,
           "turkish_word": "plan",
           "english_word": "plan",
           "type": "n",
           "turkish_sentence": "B plan ını uygulamak istemiyorsan iyi bir A plan ın olmalı.",
           "english_sentence": "If you don’t want to go to plan B you should have a good plan A."
        },
        {
           "id": 1770,
           "turkish_word": "nerede",
           "english_word": "where",
           "type": "adv",
           "turkish_sentence": "Çantam nerede ?",
           "english_sentence": "Where is my purse?"
        },
        {
           "id": 1771,
           "turkish_word": "gibiydi",
           "english_word": "was like",
           "type": "postp",
           "turkish_sentence": "O geceyi unutmak istiyorum, kabus gibiydi.",
           "english_sentence": "I want to forget that night, it was like nightmare."
        },
        {
           "id": 1772,
           "turkish_word": "gösteriyor",
           "english_word": "shows",
           "type": "v",
           "turkish_sentence": "Kanıtlar suçun önceden planlandığını gösteriyor.",
           "english_sentence": "The evidence shows that the crime was premeditated."
        },
        {
           "id": 1773,
           "turkish_word": "evin",
           "english_word": "of the house",
           "type": "n",
           "turkish_sentence": "Tüm gece evin etrafında dolanan bir adam gördüm.",
           "english_sentence": "I saw a man wandering around the house all night."
        },
        {
           "id": 1774,
           "turkish_word": "kalsın",
           "english_word": "keep; stay",
           "type": "v",
           "turkish_sentence": "Çakmağa ihtiyacım yok, sende kalsın.",
           "english_sentence": "I don’t need the lighter, keep it."
        },
        {
           "id": 1775,
           "turkish_word": "neredesin/(often uttered as “nerdesin”)",
           "english_word": "",
           "type": "adv",
           "turkish_sentence": "Hala seni bekliyorum, neredesin?",
           "english_sentence": "I’m still waiting for you; where are you?",
           "notes": "often uttered as “nerdesin”"
        },
        {
           "id": 1776,
           "turkish_word": "şarap",
           "english_word": "wine",
           "type": "n",
           "turkish_sentence": "Sağlığa yararlı diye, her gün iki şişe şarap mı içmen gerektiğini düşünüyorsun?",
           "english_sentence": "Do you think you have to drink two bottles of wine just because it’s healthy?"
        },
        {
           "id": 1777,
           "turkish_word": "düzgün",
           "english_word": "proper, smooth",
           "type": "adj",
           "turkish_sentence": "Doğru, düzgün bir iş bulup çalışman gerek.",
           "english_sentence": "You need to find a right and proper job and work."
        },
        {
           "id": 1778,
           "turkish_word": "peder",
           "english_word": "father or dad",
           "type": "n",
           "turkish_sentence": "Benim peder le buraya balık tutmaya gelirdik.",
           "english_sentence": "My dad and I used to come here for fishing."
        },
        {
           "id": 1779,
           "turkish_word": "edersin",
           "english_word": "you do/perform",
           "type": "aux",
           "turkish_sentence": "Ne sıklıkla {seyahat} edersin ?",
           "english_sentence": "How often do you travel ?",
           "notes": "auxilary verb used with nouns"
        },
        {
           "id": 1780,
           "turkish_word": "adamla",
           "english_word": "with man",
           "type": "adv",
           "turkish_sentence": "Adamla ne konuştun?",
           "english_sentence": "What did you talk about with the man ?"
        },
        {
           "id": 1781,
           "turkish_word": "sarhoş",
           "english_word": "drunk",
           "type": "adv",
           "turkish_sentence": "Barmen çok sarhoş olduğunu söyledi.",
           "english_sentence": "Bartender told me that he is very drunk."
        },
        {
           "id": 1782,
           "turkish_word": "veririm",
           "english_word": "I would give",
           "type": "v",
           "turkish_sentence": "Senin için canımı veririm.",
           "english_sentence": "I would give my life for you."
        },
        {
           "id": 1783,
           "turkish_word": "muydun",
           "english_word": "were you",
           "type": "inter",
           "turkish_sentence": "Seni aradığımda uyuyor muydun ?",
           "english_sentence": "Were you sleeping when I called you?"
        },
        {
           "id": 1784,
           "turkish_word": "gerekirse",
           "english_word": "if needed",
           "type": "adv",
           "turkish_sentence": "Gerekirse yeniden orduya katılabilirim.",
           "english_sentence": "I can join the army again if needed."
        },
        {
           "id": 1785,
           "turkish_word": "gemi",
           "english_word": "ship",
           "type": "n",
           "turkish_sentence": "Gemi bugün geliyor.",
           "english_sentence": "The ship arrives today."
        },
        {
           "id": 1786,
           "turkish_word": "buradasın",
           "english_word": "you are here",
           "type": "v",
           "turkish_sentence": "Ah, buradasın ! Seni arıyordum.",
           "english_sentence": "Oh, you are here ! I was looking for you."
        },
        {
           "id": 1787,
           "turkish_word": "önemi",
           "english_word": "the importance of",
           "type": "n",
           "turkish_sentence": "“Ciddi Olmanın Önemi ” kitabını okudun mu?",
           "english_sentence": "Have you read “The Importance of Being Earnest”?"
        },
        {
           "id": 1788,
           "turkish_word": "hayvan",
           "english_word": "animal",
           "type": "n",
           "turkish_sentence": "Nesli tükenen hayvan ları korumalıyız.",
           "english_sentence": "We need to save extinct animals."
        },
        {
           "id": 1789,
           "turkish_word": "metre",
           "english_word": "meter",
           "type": "n",
           "turkish_sentence": "Mağaza 400 metre uzakta.",
           "english_sentence": "The shop is 400 meters away."
        },
        {
           "id": 1790,
           "turkish_word": "kat",
           "english_word": "floor",
           "type": "n",
           "turkish_sentence": "Bina 30 kat lı.",
           "english_sentence": "The building has 30 floors."
        },
        {
           "id": 1791,
           "turkish_word": "sevdim",
           "english_word": "I liked",
           "type": "v",
           "turkish_sentence": "Tarzını sevdim.",
           "english_sentence": "I liked your style."
        },
        {
           "id": 1792,
           "turkish_word": "gelmiyor",
           "english_word": "not coming",
           "type": "v",
           "turkish_sentence": "Bu geceki partiye o gelmiyor.",
           "english_sentence": "She is not coming to party tonight."
        },
        {
           "id": 1793,
           "turkish_word": "çavuş",
           "english_word": "sergeant",
           "type": "n",
           "turkish_sentence": "John, ABD silahlı kuvvetlerinde çavuş olarak görev yapıyordu.",
           "english_sentence": "John was serving as a sergeant in the US armed forces."
        },
        {
           "id": 1794,
           "turkish_word": "hani",
           "english_word": "where?",
           "type": "adv",
           "turkish_sentence": "Hani benim hediyem?",
           "english_sentence": "Where is my present?"
        },
        {
           "id": 1795,
           "turkish_word": "orada",
           "english_word": "there",
           "type": "adv",
           "turkish_sentence": "Orda kimse var mı?",
           "english_sentence": "Is anyone there ?"
        },
        {
           "id": 1796,
           "turkish_word": "sorunun",
           "english_word": "your problem",
           "type": "n",
           "turkish_sentence": "Sorunun u ailenle paylaşmalısın.",
           "english_sentence": "You should share your problem with your family."
        },
        {
           "id": 1797,
           "turkish_word": "iğrenç",
           "english_word": "disgusting",
           "type": "adv",
           "turkish_sentence": "Bu yemek iğrenç görünüyor.",
           "english_sentence": "This dish looks disgusting."
        },
        {
           "id": 1798,
           "turkish_word": "sahte",
           "english_word": "fake",
           "type": "adj",
           "turkish_sentence": "Uzun zamandır sahte bir kimlik kullanıyor.",
           "english_sentence": "He’s been using a fake identity for a long time."
        },
        {
           "id": 1799,
           "turkish_word": "baştan",
           "english_word": "from the beginning",
           "type": "adv",
           "turkish_sentence": "Anlamadım, bütün hikayeyi baştan anlat.",
           "english_sentence": "I didn’t get that, tell me the whole story from the beginning."
        },
        {
           "id": 1800,
           "turkish_word": "istiyorlar",
           "english_word": "they want",
           "type": "v",
           "turkish_sentence": "Çocuklar onlarla oynamamı istiyorlar.",
           "english_sentence": "The children want me to play with them."
        },
        {
           "id": 1801,
           "turkish_word": "gözlerin",
           "english_word": "your eyes",
           "type": "n",
           "turkish_sentence": "Müzik dinlerken gözlerin i kapat.",
           "english_sentence": "Close your eyes when you listen to music."
        },
        {
           "id": 1802,
           "turkish_word": "olabilirsin",
           "english_word": "you can/may",
           "type": "v",
           "turkish_sentence": "Çok çalışırsan başarılı olabilirsin.",
           "english_sentence": "You can be successful if you work hard."
        },
        {
           "id": 1803,
           "turkish_word": "sürpriz",
           "english_word": "surprise",
           "type": "n",
           "turkish_sentence": "Ona doğum gününde sürpriz yapmak için pasta hazırladım.",
           "english_sentence": "In order to give him a surprise on his birthday I prepared a cake."
        },
        {
           "id": 1804,
           "turkish_word": "yarısı",
           "english_word": "half",
           "type": "adj",
           "turkish_sentence": "Hayatımın yarısı nı onu arayarak geçirdim.",
           "english_sentence": "I have spent half of my life looking for him."
        },
        {
           "id": 1805,
           "turkish_word": "bomba",
           "english_word": "bomb",
           "type": "n",
           "turkish_sentence": "Asker kabloyu kesti ve bomba yı etkisiz hale getirdi.",
           "english_sentence": "The soldier cut the wire and defused the bomb."
        },
        {
           "id": 1806,
           "turkish_word": "öldürmek",
           "english_word": "to kill",
           "type": "n",
           "turkish_sentence": "Beni öldürme ye mi çalışıyorsun?",
           "english_sentence": "Are you trying to kill me?"
        },
        {
           "id": 1807,
           "turkish_word": "sanmıştım",
           "english_word": "I thought",
           "type": "v",
           "turkish_sentence": "Beni sevdiğini sanmıştım.",
           "english_sentence": "I thought you loved me."
        },
        {
           "id": 1808,
           "turkish_word": "muyum",
           "english_word": "am I/do I",
           "type": "interr",
           "turkish_sentence": "Seni tanıyor muyum ?",
           "english_sentence": "Do I know you?"
        },
        {
           "id": 1809,
           "turkish_word": "arkasında",
           "english_word": "behind",
           "type": "postp",
           "turkish_sentence": "Duvarın arkasında bir kutu var.",
           "english_sentence": "There is a box behind the wall."
        },
        {
           "id": 1810,
           "turkish_word": "çıkıyor",
           "english_word": "he/she is getting out",
           "type": "v",
           "turkish_sentence": "Suçlu hapisten çıkıyor.",
           "english_sentence": "The criminal is getting out of the jail."
        },
        {
           "id": 1811,
           "turkish_word": "gitmeliyiz",
           "english_word": "we should/must go",
           "type": "v",
           "turkish_sentence": "Karanlık oluyor, gitmeliyiz.",
           "english_sentence": "It is getting dark here, we should go."
        },
        {
           "id": 1812,
           "turkish_word": "sever",
           "english_word": "likes",
           "type": "v",
           "turkish_sentence": "Ayşe kitap okumayı sever.",
           "english_sentence": "Ayşe likes reading."
        },
        {
           "id": 1813,
           "turkish_word": "olmam",
           "english_word": "I don’t",
           "type": "v",
           "turkish_sentence": "Umarım bunu yaptığıma pişman olmam.",
           "english_sentence": "I hope I don’t regret doing that.",
           "notes": "be"
        },
        {
           "id": 1814,
           "turkish_word": "san",
           "english_word": "title or fame",
           "type": "n",
           "turkish_sentence": "Adı san ı duyulmamış bir üniversiteye gittim.",
           "english_sentence": "I attended a university which wasn’t of any fame."
        },
        {
           "id": 1815,
           "turkish_word": "olduğunda",
           "english_word": "when",
           "type": "adv",
           "turkish_sentence": "Karanlık olduğunda birçok hayvan keskin duyularını kullanır.",
           "english_sentence": "When the dark comes, most animals use their acute senses."
        },
        {
           "id": 1816,
           "turkish_word": "söylemişti",
           "english_word": "had said",
           "type": "v",
           "turkish_sentence": "Annem bunun olacağını söylemişti.",
           "english_sentence": "My mom had said that would happen."
        },
        {
           "id": 1817,
           "turkish_word": "güzeldi",
           "english_word": "was nice",
           "type": "v",
           "turkish_sentence": "Sizinle tanışmak güzeldi.",
           "english_sentence": "It was nice to meet you."
        },
        {
           "id": 1818,
           "turkish_word": "Muhammet",
           "english_word": "Muhammet",
           "type": "n",
           "turkish_sentence": "Muhammet iş bulmak için Fransa’ya gitti.",
           "english_sentence": "Muhammet went to France to find a job.",
           "notes": "masculine name"
        },
        {
           "id": 1819,
           "turkish_word": "başlıyor",
           "english_word": "starting",
           "type": "v",
           "turkish_sentence": "Film başlıyor.",
           "english_sentence": "The movie is starting."
        },
        {
           "id": 1820,
           "turkish_word": "edebilirim",
           "english_word": "I can",
           "type": "v",
           "turkish_sentence": "İstersen sana yardım edebilirim.",
           "english_sentence": "I can help you if you like.",
           "notes": "make"
        },
        {
           "id": 1821,
           "turkish_word": "olduğunuzu",
           "english_word": "that you are",
           "type": "ptcp",
           "turkish_sentence": "Üzgün olduğunuzu biliyorum.",
           "english_sentence": "I know that you are sad."
        },
        {
           "id": 1822,
           "turkish_word": "inanıyorum",
           "english_word": "I believe",
           "type": "v",
           "turkish_sentence": "Senin yalan söylediğini söylüyorlar, ama ben sana inanıyorum.",
           "english_sentence": "They say you are lying but I believe in you."
        },
        {
           "id": 1823,
           "turkish_word": "annemin",
           "english_word": "my mom",
           "type": "n",
           "turkish_sentence": "Annemin arabası var.",
           "english_sentence": "My mom has a car."
        },
        {
           "id": 1824,
           "turkish_word": "arıyorsun",
           "english_word": "you are looking for",
           "type": "v",
           "turkish_sentence": "Ne arıyorsun ?",
           "english_sentence": "What are you looking for ?"
        },
        {
           "id": 1825,
           "turkish_word": "bazıları",
           "english_word": "some",
           "type": "pron",
           "turkish_sentence": "Bazı insanlar doğuştan zekidir, bazıları doğuştan güzel.",
           "english_sentence": "Some people are born clever, some are born beautiful."
        },
        {
           "id": 1826,
           "turkish_word": "konuşuyor",
           "english_word": "is talking/talks",
           "type": "v",
           "turkish_sentence": "O hep evlilik hakkında konuşuyor.",
           "english_sentence": "He always talks about marriage."
        },
        {
           "id": 1827,
           "turkish_word": "kalmış",
           "english_word": "stayed",
           "type": "adv",
           "turkish_sentence": "Tüm gece dışarıda kalmış gibi görünüyorsun.",
           "english_sentence": "You look like you stayed out all night."
        },
        {
           "id": 1828,
           "turkish_word": "piç",
           "english_word": "bastard",
           "type": "n",
           "turkish_sentence": "O bir yetimhanede büyüdü, arkadaşları ona hakaret eder ve ona piç olduğunu söylerlerdi.",
           "english_sentence": "He grew up in an orphanage; his friends used to insult him and told him he was a bastard."
        },
        {
           "id": 1829,
           "turkish_word": "başladım",
           "english_word": "I started",
           "type": "v",
           "turkish_sentence": "Ünlüleri Twitter’dan takip etmeye başladım.",
           "english_sentence": "I started to follow celebrities on Twitter."
        },
        {
           "id": 1830,
           "turkish_word": "konuşabilir",
           "english_word": "he/she can speak",
           "type": "v",
           "turkish_sentence": "O Türkçeyi çok iyi konuşabilir.",
           "english_sentence": "She can speak Turkish very well."
        },
        {
           "id": 1831,
           "turkish_word": "oturup",
           "english_word": "sitting",
           "type": "ptcp",
           "turkish_sentence": "Burada oturup yeni kitabımı yazdığımı hatırlıyorum.",
           "english_sentence": "I remember sitting there and writing my new book."
        },
        {
           "id": 1832,
           "turkish_word": "koş",
           "english_word": "run",
           "type": "v",
           "turkish_sentence": "Otobüsü kaçırıyorsun! Koş !",
           "english_sentence": "You are missing the bus! Run !"
        },
        {
           "id": 1833,
           "turkish_word": "etmek",
           "english_word": "to do",
           "type": "aux",
           "turkish_sentence": "Arabaları tamir etme yi seviyorum.",
           "english_sentence": "I like to repair cars.",
           "notes": "auxilary verb used with nouns"
        },
        {
           "id": 1834,
           "turkish_word": "gelen",
           "english_word": "comer",
           "type": "n",
           "turkish_sentence": "Geç gelen lerin içeriye girmesine izin vermeyin.",
           "english_sentence": "Don’t let latecomers get in."
        },
        {
           "id": 1835,
           "turkish_word": "ikimiz",
           "english_word": "we both",
           "type": "pron",
           "turkish_sentence": "İkimiz de köpekleri seviyoruz.",
           "english_sentence": "We both love dogs."
        },
        {
           "id": 1836,
           "turkish_word": "elimizde",
           "english_word": "in our hands",
           "type": "adv",
           "turkish_sentence": "Her şey bizim elimizde.",
           "english_sentence": "Everything is in our hands."
        },
        {
           "id": 1837,
           "turkish_word": "uçak",
           "english_word": "plane",
           "type": "n",
           "turkish_sentence": "Uçak ta küçük bir çocuk vardı.",
           "english_sentence": "There was a small kid on the plane."
        },
        {
           "id": 1838,
           "turkish_word": "getirin",
           "english_word": "bring",
           "type": "v",
           "turkish_sentence": "Onu buraya getirin !",
           "english_sentence": "Bring him over here!"
        },
        {
           "id": 1839,
           "turkish_word": "tutun",
           "english_word": "hold on",
           "type": "v",
           "turkish_sentence": "Ağaca tırman ve sıkı tutun.",
           "english_sentence": "Climb the tree and hold on tight."
        },
        {
           "id": 1840,
           "turkish_word": "uyan",
           "english_word": "wake up",
           "type": "v",
           "turkish_sentence": "Sabah oldu, uyan.",
           "english_sentence": "It’s morning, wake up."
        },
        {
           "id": 1841,
           "turkish_word": "şeker",
           "english_word": "candy",
           "type": "n",
           "turkish_sentence": "Şeker, dişleri çürütür.",
           "english_sentence": "Candy rots the teeth."
        },
        {
           "id": 1842,
           "turkish_word": "nasıl",
           "english_word": "how",
           "type": "adv",
           "turkish_sentence": "Günün nasıl geçti?",
           "english_sentence": "How was your day?"
        },
        {
           "id": 1843,
           "turkish_word": "miydin",
           "english_word": "had/were you",
           "type": "interr",
           "turkish_sentence": "Kavga başladığında içkili miydin ?",
           "english_sentence": "Were you drunk when the fight began?"
        },
        {
           "id": 1844,
           "turkish_word": "rica",
           "english_word": "request ; you’re welcome",
           "type": "n",
           "turkish_sentence": "Bir rica m olacak.",
           "english_sentence": "I have a request."
        },
        {
           "id": 1845,
           "turkish_word": "evli",
           "english_word": "married",
           "type": "adj",
           "turkish_sentence": "2009’dan beri evli yiz.",
           "english_sentence": "We have been married since 2009."
        },
        {
           "id": 1846,
           "turkish_word": "yeşil",
           "english_word": "green",
           "type": "adj",
           "turkish_sentence": "Yeşil kabloyu kes ve düğmeye bas.",
           "english_sentence": "Cut the green wire and press the button."
        },
        {
           "id": 1847,
           "turkish_word": "genelde",
           "english_word": "usually",
           "type": "adv",
           "turkish_sentence": "Hafta sonu genelde geç kalkarım.",
           "english_sentence": "I usually get up late at the weekend."
        },
        {
           "id": 1848,
           "turkish_word": "alırım",
           "english_word": "I take/get",
           "type": "v",
           "turkish_sentence": "Her sabah duş alırım.",
           "english_sentence": "I take a shower every morning."
        },
        {
           "id": 1849,
           "turkish_word": "öylece",
           "english_word": "just",
           "type": "adv",
           "turkish_sentence": "Öylece gidiyor musun?",
           "english_sentence": "You are just leaving, like that?"
        },
        {
           "id": 1850,
           "turkish_word": "adamları",
           "english_word": "the men",
           "type": "n",
           "turkish_sentence": "Polis bana saldıran adamları görüp görmediğimi sordu.",
           "english_sentence": "The police asked me if I saw the men who attacked me."
        },
        {
           "id": 1851,
           "turkish_word": "anlamadım",
           "english_word": "I didn’t understand",
           "type": "v",
           "turkish_sentence": "Ne söylediğini anlamadım. Tekrar eder misin?",
           "english_sentence": "I didn’t understand what you just said. Can you repeat it?"
        },
        {
           "id": 1852,
           "turkish_word": "bayağı",
           "english_word": "banal",
           "type": "adv",
           "turkish_sentence": "O, Türk şiirini sıkıcı ve bayağı buluyor.",
           "english_sentence": "He finds Turkish poetry boring and banal."
        },
        {
           "id": 1853,
           "turkish_word": "üzgün",
           "english_word": "sad",
           "type": "adj",
           "turkish_sentence": "Hakan kız arkadaşından ayrıldığı için çok üzgün.",
           "english_sentence": "Hakan is very sad because he separated from his girlfriend."
        },
        {
           "id": 1854,
           "turkish_word": "buz",
           "english_word": "ice",
           "type": "n",
           "turkish_sentence": "İçkin için biraz daha buz ister misin?",
           "english_sentence": "Do you want some more ice for your drink?"
        },
        {
           "id": 1855,
           "turkish_word": "bekliyorum",
           "english_word": "I’m waiting",
           "type": "v",
           "turkish_sentence": "Burada birini bekliyorum.",
           "english_sentence": "I’m waiting for someone here."
        },
        {
           "id": 1856,
           "turkish_word": "elimde",
           "english_word": "in my hand",
           "type": "adv",
           "turkish_sentence": "Evden çıktığımda anahtarlar elimde ydi.",
           "english_sentence": "I had the keys in my hand when I left home."
        },
        {
           "id": 1857,
           "turkish_word": "İsa",
           "english_word": "Jesus",
           "type": "n",
           "turkish_sentence": "İsa ’nın adına dua etmeliyiz.",
           "english_sentence": "We must pray in the name of Jesus."
        },
        {
           "id": 1858,
           "turkish_word": "olanı",
           "english_word": "the one",
           "type": "n",
           "turkish_sentence": "Mavi olanı bana uzatır mısın?",
           "english_sentence": "Can you pass me the blue one ?"
        },
        {
           "id": 1859,
           "turkish_word": "arama",
           "english_word": "search",
           "type": "n",
           "turkish_sentence": "Polisin onun evini arama izni yoktu.",
           "english_sentence": "The police didn’t have a search warrant on his house."
        },
        {
           "id": 1860,
           "turkish_word": "zorundayız",
           "english_word": "we have to",
           "type": "v",
           "turkish_sentence": "İklim değişikliğini durdurmanın yollarını bulmak zorundayız.",
           "english_sentence": "We have to find the ways to stop climate change."
        },
        {
           "id": 1861,
           "turkish_word": "daima",
           "english_word": "always",
           "type": "adv",
           "turkish_sentence": "Seni daima seveceğim.",
           "english_sentence": "I will always love you."
        },
        {
           "id": 1862,
           "turkish_word": "teki",
           "english_word": "a/an",
           "type": "n",
           "turkish_sentence": "Adamın teki sokakta yanıma yaklaştı.",
           "english_sentence": "A man approached me on the street."
        },
        {
           "id": 1863,
           "turkish_word": "çalış",
           "english_word": "work",
           "type": "v",
           "turkish_sentence": "Başarılı olmak istiyorsan çok çalış.",
           "english_sentence": "Work hard if you want to be successful."
        },
        {
           "id": 1864,
           "turkish_word": "konuyu",
           "english_word": "the topic",
           "type": "n",
           "turkish_sentence": "Konuyu değiştirebilir miyiz lütfen?",
           "english_sentence": "Can we change the topic, please?"
        },
        {
           "id": 1865,
           "turkish_word": "ararım",
           "english_word": "I call",
           "type": "v",
           "turkish_sentence": "Her sabah annemi ararım.",
           "english_sentence": "I call my mom every morning."
        },
        {
           "id": 1866,
           "turkish_word": "yatak",
           "english_word": "bed",
           "type": "n",
           "turkish_sentence": "Soğuk günlerde yatak tan çıkmayı sevmiyorum.",
           "english_sentence": "I don’t like getting out of bed on cold days."
        },
        {
           "id": 1867,
           "turkish_word": "buldu",
           "english_word": "he/she/it found",
           "type": "v",
           "turkish_sentence": "Mahkeme çete üyelerini suçlu buldu.",
           "english_sentence": "The court found gang members guilty."
        },
        {
           "id": 1868,
           "turkish_word": "şimdilik",
           "english_word": "for now",
           "type": "adv",
           "turkish_sentence": "Şimdilik hoşça kal.",
           "english_sentence": "Goodbye for now."
        },
        {
           "id": 1869,
           "turkish_word": "özgür",
           "english_word": "free",
           "type": "adj",
           "turkish_sentence": "Özgür bir basın, demokrasi için gereklidir.",
           "english_sentence": "A free press is essential for democracy."
        },
        {
           "id": 1870,
           "turkish_word": "hapse",
           "english_word": "to jail",
           "type": "n",
           "turkish_sentence": "Kardeşini kurtarmak için hapse girmek istiyor.",
           "english_sentence": "He wants to go to jail to save his brother."
        },
        {
           "id": 1871,
           "turkish_word": "aramızda",
           "english_word": "among us, between us",
           "type": "adv",
           "turkish_sentence": "Aramızda en güçlüsü sensin.",
           "english_sentence": "You are the strongest among us."
        },
        {
           "id": 1872,
           "turkish_word": "akıllı",
           "english_word": "smart",
           "type": "adj",
           "turkish_sentence": "Sandığım kadar akıllı değilsin.",
           "english_sentence": "You are not as smart as I thought."
        },
        {
           "id": 1873,
           "turkish_word": "olsam",
           "english_word": "if I were",
           "type": "adv",
           "turkish_sentence": "Zengin olsam Ferrari alırdım.",
           "english_sentence": "If I were rich, I would buy a Ferrari."
        },
        {
           "id": 1874,
           "turkish_word": "rüya",
           "english_word": "dream",
           "type": "n",
           "turkish_sentence": "Dün gece garip bir rüya gördüm.",
           "english_sentence": "I had a strange dream last night."
        },
        {
           "id": 1875,
           "turkish_word": "olduklarını",
           "english_word": "that they are",
           "type": "ptcp",
           "turkish_sentence": "Onların iyi insanlar olduklarını düşünebilirsin fakat aslında ikiyüzlüler.",
           "english_sentence": "You might think that they are good people, but they are actually hypocrites."
        },
        {
           "id": 1876,
           "turkish_word": "akşamlar",
           "english_word": "evening",
           "type": "n",
           "turkish_sentence": "İyi akşamlar !",
           "english_sentence": "Good evening !"
        },
        {
           "id": 1877,
           "turkish_word": "girdi",
           "english_word": "entered",
           "type": "n",
           "turkish_sentence": "Türkiye 1914’te resmen savaşa girdi.",
           "english_sentence": "Turkey formally entered the war in 1914."
        },
        {
           "id": 1878,
           "turkish_word": "gelmedi",
           "english_word": "didn’t come",
           "type": "v",
           "turkish_sentence": "Babam dün gece eve gelmedi.",
           "english_sentence": "My father didn’t come home last night."
        },
        {
           "id": 1879,
           "turkish_word": "yazıyor",
           "english_word": "typing",
           "type": "v",
           "turkish_sentence": "O bir rapor yazıyor.",
           "english_sentence": "He is typing a report."
        },
        {
           "id": 1880,
           "turkish_word": "profesör",
           "english_word": "professor",
           "type": "n",
           "turkish_sentence": "Üniversitemin profesör lerinden biri, tezimi bitirmemde bana yardımcı oldu.",
           "english_sentence": "One of the professors of my university helped me to finish my dissertation."
        },
        {
           "id": 1881,
           "turkish_word": "hamile",
           "english_word": "pregnant",
           "type": "adj",
           "turkish_sentence": "Sigara içmek hamile kalma şansını azaltır.",
           "english_sentence": "Smoking reduces the chance of getting pregnant."
        },
        {
           "id": 1882,
           "turkish_word": "geçiyor",
           "english_word": "passes/passing",
           "type": "v",
           "turkish_sentence": "Zaman çok çabuk geçiyor.",
           "english_sentence": "Time passes quickly."
        },
        {
           "id": 1883,
           "turkish_word": "giriş",
           "english_word": "entrance",
           "type": "n",
           "turkish_sentence": "Giriş ücreti çok pahalıydı, bu yüzden başka yere gitmeye karar verdik.",
           "english_sentence": "The entrance fee was expensive, so we decided to go somewhere else."
        },
        {
           "id": 1884,
           "turkish_word": "İbrahim",
           "english_word": "İbrahim",
           "type": "n",
           "turkish_sentence": "İbrahim yeni evine taşındı.",
           "english_sentence": "İbrahim moved into his new house.",
           "notes": "masculine name"
        },
        {
           "id": 1885,
           "turkish_word": "etmeyin",
           "english_word": "don’t",
           "type": "aux",
           "turkish_sentence": "Beyler, lütfen kavga etmeyin !",
           "english_sentence": "Guys, please don’t fight !",
           "notes": "auxilary verb used with nouns"
        },
        {
           "id": 1886,
           "turkish_word": "havaya",
           "english_word": "into the air",
           "type": "adv",
           "turkish_sentence": "Polisler havaya ateş açtı.",
           "english_sentence": "The cops fired their guns into the air."
        },
        {
           "id": 1887,
           "turkish_word": "kaybettim",
           "english_word": "I lost",
           "type": "v",
           "turkish_sentence": "Valizimi hava alanında kaybettim.",
           "english_sentence": "I lost my luggage at the airport."
        },
        {
           "id": 1888,
           "turkish_word": "diğerleri",
           "english_word": "others",
           "type": "pron",
           "turkish_sentence": "Bazı projeler diğerleri nden daha kısadır.",
           "english_sentence": "Some projects are shorter than others."
        },
        {
           "id": 1889,
           "turkish_word": "korkuyorum",
           "english_word": "I’m scared",
           "type": "v",
           "turkish_sentence": "Korku filmleri yüzünden palyaçolardan korkuyorum.",
           "english_sentence": "I am scared of clowns because of horror movies."
        },
        {
           "id": 1890,
           "turkish_word": "kadarıyla",
           "english_word": "as far as",
           "type": "postp",
           "turkish_sentence": "Bildiğim kadarıyla 30 yıldır Türkiye’de yaşıyor.",
           "english_sentence": "As far as I know, she has been living in Turkey for 30 years."
        },
        {
           "id": 1891,
           "turkish_word": "değildim",
           "english_word": "I wasn’t",
           "type": "v",
           "turkish_sentence": "Fotoğrafımın çekildiğinin farkında değildim.",
           "english_sentence": "I wasn’t aware that I was being photographed."
        },
        {
           "id": 1892,
           "turkish_word": "kaldır",
           "english_word": "remove or lift",
           "type": "v",
           "turkish_sentence": "Kutuyu kaldır amadım; çok ağırdı.",
           "english_sentence": "I couldn’t lift the box; it was too heavy."
        },
        {
           "id": 1893,
           "turkish_word": "Hüseyin",
           "english_word": "Hüseyin",
           "type": "n",
           "turkish_sentence": "Yarın Hüseyin geliyor.",
           "english_sentence": "Hüseyin is coming tomorrow.",
           "notes": "masculine name"
        },
        {
           "id": 1894,
           "turkish_word": "gittiğini",
           "english_word": "have/had gone/went or going",
           "type": "ptcp",
           "turkish_sentence": "Onun nereye gittiğini biliyor musun? Do you know where she is going ?",
           "english_sentence": "Anneannenin evine gittiğini düşünmüştüm. I thought you had gone to your grandma’s house."
        },
        {
           "id": 1895,
           "turkish_word": "zayıf",
           "english_word": "thin or weak",
           "type": "adv",
           "turkish_sentence": "Hasta mısın? Çok solgun ve zayıf görünüyorsun.",
           "english_sentence": "Are you sick? You look so pale and thin."
        },
        {
           "id": 1896,
           "turkish_word": "kafa",
           "english_word": "head",
           "type": "n",
           "turkish_sentence": "O kadar aptalca davranıyor ki kafa yı yemiş olmalı.",
           "english_sentence": "She acts so stupidly that she must have rocks in her head."
        },
        {
           "id": 1897,
           "turkish_word": "söylediler",
           "english_word": "they said",
           "type": "v",
           "turkish_sentence": "Yetkililer bunun tarihteki en büyük deprem olduğunu söylediler.",
           "english_sentence": "Authorities said it was the largest earthquake in history."
        },
        {
           "id": 1898,
           "turkish_word": "derhal",
           "english_word": "immediately",
           "type": "adv",
           "turkish_sentence": "Derhal önlem almalıyız.",
           "english_sentence": "We must take precautions immediately."
        },
        {
           "id": 1899,
           "turkish_word": "söyleyecek",
           "english_word": "will tell",
           "type": "v",
           "turkish_sentence": "Sana gerçeği söyleyecek.",
           "english_sentence": "He will tell you the truth."
        },
        {
           "id": 1900,
           "turkish_word": "evinde",
           "english_word": "in his/her home",
           "type": "adv",
           "turkish_sentence": "Zavallı adam bu sabah evinde ölü bulunmuş.",
           "english_sentence": "The poor man was found dead in his home this morning."
        },
        {
           "id": 1901,
           "turkish_word": "hiçbir şey",
           "english_word": "nothing",
           "type": "pron",
           "turkish_sentence": "Hiçbir şey imkansız değildir.",
           "english_sentence": "Nothing is impossible."
        },
        {
           "id": 1902,
           "turkish_word": "mesele",
           "english_word": "problem, issue",
           "type": "n",
           "turkish_sentence": "İşsizlik bugünün dünyasında en önemli mesele lerinden biridir.",
           "english_sentence": "Unemployment is one of the top issues in today’s world."
        },
        {
           "id": 1903,
           "turkish_word": "alayım",
           "english_word": "I will have/let me take",
           "type": "v",
           "turkish_sentence": "Ben bir Türk kahvesi alayım lütfen.",
           "english_sentence": "I will have a cup of Turkish coffee, please."
        },
        {
           "id": 1904,
           "turkish_word": "avukat",
           "english_word": "lawyer",
           "type": "n",
           "turkish_sentence": "Avukat ıma güvenmiyorum.",
           "english_sentence": "I don’t trust my lawyer."
        },
        {
           "id": 1905,
           "turkish_word": "hazırım",
           "english_word": "I’m ready",
           "type": "v",
           "turkish_sentence": "Her şeye yeniden başlamaya hazırım.",
           "english_sentence": "I’m ready to start all over again."
        },
        {
           "id": 1906,
           "turkish_word": "sandım",
           "english_word": "I thought",
           "type": "v",
           "turkish_sentence": "Şaka yaptığını sandım.",
           "english_sentence": "I thought you were joking."
        },
        {
           "id": 1907,
           "turkish_word": "anlama",
           "english_word": "don’t get",
           "type": "v",
           "turkish_sentence": "Beni yanlış anlama lütfen.",
           "english_sentence": "Don’t get me wrong please."
        },
        {
           "id": 1908,
           "turkish_word": "oğlu",
           "english_word": "his/her son",
           "type": "n",
           "turkish_sentence": "Onun oğlu başarılı bir işadamı.",
           "english_sentence": "His son is a successful businessman."
        },
        {
           "id": 1909,
           "turkish_word": "konuşmak",
           "english_word": "to talk",
           "type": "n",
           "turkish_sentence": "Benimle böyle konuşma ya hakkın yok.",
           "english_sentence": "You have no right to talk to me like that."
        },
        {
           "id": 1910,
           "turkish_word": "ailesi",
           "english_word": "his/her family",
           "type": "n",
           "turkish_sentence": "Ayşe’nin ailesi Kanada’da yaşıyor.",
           "english_sentence": "Ayşe’s family live in Canada."
        },
        {
           "id": 1911,
           "turkish_word": "aldık",
           "english_word": "we got",
           "type": "v",
           "turkish_sentence": "İhtiyacımız olan her şeyi aldık.",
           "english_sentence": "We got everything we need."
        },
        {
           "id": 1912,
           "turkish_word": "ailem",
           "english_word": "my family",
           "type": "n",
           "turkish_sentence": "Ailem benim doktor olmamı istiyor.",
           "english_sentence": "My family wants me to be a doctor."
        },
        {
           "id": 1913,
           "turkish_word": "sonuna",
           "english_word": "to the end",
           "type": "adv",
           "turkish_sentence": "Çocuklar yolun sonuna kadar koştu.",
           "english_sentence": "Children ran to the end of the road."
        },
        {
           "id": 1914,
           "turkish_word": "imkansız",
           "english_word": "impossible",
           "type": "adj",
           "turkish_sentence": "Bu dağa tırmanmak imkansız.",
           "english_sentence": "It is impossible to climb this mountain."
        },
        {
           "id": 1915,
           "turkish_word": "yemeğe",
           "english_word": "to dinner/lunch",
           "type": "n",
           "turkish_sentence": "Erkek arkadaşımın ailesi beni yemeğe çağırdı.",
           "english_sentence": "My boyfriend’s family invited me to the dinner."
        },
        {
           "id": 1916,
           "turkish_word": "şerif",
           "english_word": "sheriff",
           "type": "n",
           "turkish_sentence": "Şerif, bugün bize uğrayacağını söyledi.",
           "english_sentence": "Sheriff told me that he is going to visit us today."
        },
        {
           "id": 1917,
           "turkish_word": "şurada",
           "english_word": "over there",
           "type": "adv",
           "turkish_sentence": "Şurada oturan adamı görüyor musun?",
           "english_sentence": "Do you see that man sitting over there ?"
        },
        {
           "id": 1918,
           "turkish_word": "aklıma",
           "english_word": "to my mind",
           "type": "adv",
           "turkish_sentence": "Üniversite anılarım aklıma geliyor.",
           "english_sentence": "My college memories come to my mind."
        },
        {
           "id": 1919,
           "turkish_word": "söylemem",
           "english_word": "I won’t tell",
           "type": "v",
           "turkish_sentence": "Yemin ederim, sırrını kimseye söylemem.",
           "english_sentence": "I promise, I won’t tell your secret to anyone."
        },
        {
           "id": 1920,
           "turkish_word": "dokuz",
           "english_word": "nine",
           "type": "num",
           "turkish_sentence": "Kardeşini görmeyeli dokuz sene olmuştu.",
           "english_sentence": "It had been nine years since she had seen her brother."
        },
        {
           "id": 1921,
           "turkish_word": "New York",
           "english_word": "New York",
           "type": "n",
           "turkish_sentence": "Amerikan Edebiyatı okumak için New York ’a gitti.",
           "english_sentence": "He went to New York to study American Literature."
        },
        {
           "id": 1922,
           "turkish_word": "kurtarmak",
           "english_word": "to save",
           "type": "v",
           "turkish_sentence": "Dünyayı yalnızca sevgi kurtar abilir.",
           "english_sentence": "Only love can save the world."
        },
        {
           "id": 1923,
           "turkish_word": "ölmek",
           "english_word": "to die",
           "type": "v",
           "turkish_sentence": "Ali’nin eceliyle öl düğünü sanmıyorum.",
           "english_sentence": "I don’t believe Ali died a natural death."
        },
        {
           "id": 1924,
           "turkish_word": "bunlardan",
           "english_word": "of these",
           "type": "n",
           "turkish_sentence": "Kitapta birçok Türkçe kelime var, bunlardan bazılarını anlamak kolay.",
           "english_sentence": "There are lots of words in Turkish in the book; some of these are easy to understand."
        },
        {
           "id": 1925,
           "turkish_word": "düştü",
           "english_word": "fell",
           "type": "v",
           "turkish_sentence": "Ağaçtan bir elma düştü.",
           "english_sentence": "An apple fell off the tree."
        },
        {
           "id": 1926,
           "turkish_word": "iyiydi",
           "english_word": "good",
           "type": "v",
           "turkish_sentence": "Bu iyiydi.",
           "english_sentence": "That’s a good one."
        },
        {
           "id": 1927,
           "turkish_word": "Murat",
           "english_word": "Murat",
           "type": "n",
           "turkish_sentence": "Murat okulumuzdaki en tatlı çocuk.",
           "english_sentence": "Murat is the cutest guy in our school.",
           "notes": "masculine name"
        },
        {
           "id": 1928,
           "turkish_word": "zamana",
           "english_word": "",
           "type": "adv",
           "turkish_sentence": "Bu zamana kadar bu ilişki için elimden geleni yaptım.",
           "english_sentence": "I have done my best for this relationship until this time.",
           "notes": "until/to"
        },
        {
           "id": 1929,
           "turkish_word": "Merve",
           "english_word": "Merve",
           "type": "n",
           "turkish_sentence": "Merve Twitch’te yayın yapmaya başladı.",
           "english_sentence": "Merve started streaming on Twitch.",
           "notes": "feminine name"
        },
        {
           "id": 1930,
           "turkish_word": "Mert",
           "english_word": "Mert",
           "type": "n",
           "turkish_sentence": "Mert babasından nefret ediyor.",
           "english_sentence": "Mert hates his father.",
           "notes": "masculine name"
        },
        {
           "id": 1931,
           "turkish_word": "demiştim",
           "english_word": "I told",
           "type": "v",
           "turkish_sentence": "Sana bu plan işlemez demiştim.",
           "english_sentence": "I told you that this plan wouldn’t work out."
        },
        {
           "id": 1932,
           "turkish_word": "odasında",
           "english_word": "in his/her room",
           "type": "adv",
           "turkish_sentence": "Ailesi partiye gitmesine izin vermediği için odasında ağlıyor.",
           "english_sentence": "She is crying in her room because her parents won’t let her go to the party."
        },
        {
           "id": 1933,
           "turkish_word": "silahını",
           "english_word": "his/her gun",
           "type": "n",
           "turkish_sentence": "Hırsız, yaşlı adama silahını doğrulttu.",
           "english_sentence": "The thief pointed his gun at the old man."
        },
        {
           "id": 1934,
           "turkish_word": "dönmek",
           "english_word": "to turn",
           "type": "v",
           "turkish_sentence": "Tekerlekler dönme ye başladı.",
           "english_sentence": "The wheels started to turn."
        },
        {
           "id": 1935,
           "turkish_word": "beyin",
           "english_word": "brain",
           "type": "n",
           "turkish_sentence": "Futbolcuda çarpışma sonrası beyin hasarı oluştu.",
           "english_sentence": "The soccer player suffered brain damage after a collision."
        },
        {
           "id": 1936,
           "turkish_word": "iptal",
           "english_word": "cancel",
           "type": "v",
           "turkish_sentence": "Şirket toplantıyı iptal etti.",
           "english_sentence": "The company cancelled the meeting."
        },
        {
           "id": 1937,
           "turkish_word": "kime",
           "english_word": "to whom",
           "type": "pron",
           "turkish_sentence": "Bu hediyeyi kime vereceksin ?",
           "english_sentence": "To whom are you giving that present?"
        },
        {
           "id": 1938,
           "turkish_word": "çekici",
           "english_word": "attractive",
           "type": "adv",
           "turkish_sentence": "İnsanlar beni çekici bulmazlar.",
           "english_sentence": "People don’t find me attractive."
        },
        {
           "id": 1939,
           "turkish_word": "şeytan",
           "english_word": "devil",
           "type": "n",
           "turkish_sentence": "Bana kötü şeyler yaptırdı, şeytan gibi o.",
           "english_sentence": "She made me do terrible things, she is like a devil."
        },
        {
           "id": 1940,
           "turkish_word": "çalışmak",
           "english_word": "to work",
           "type": "v",
           "turkish_sentence": "Sanayi Devrimi’nde çocuklar tehlikeli koşullar altında çalışmak zorunda kaldı.",
           "english_sentence": "Children had to work under dangerous conditions during the Industrial Revolution."
        },
        {
           "id": 1941,
           "turkish_word": "etrafta",
           "english_word": "around",
           "type": "adv",
           "turkish_sentence": "Etrafta kimse yok.",
           "english_sentence": "There is no one around."
        },
        {
           "id": 1942,
           "turkish_word": "Majesteleri",
           "english_word": "majesty",
           "type": "n",
           "turkish_sentence": "Majesteleri, size saygısızlık etmek istememiştim, lütfen beni bağışlayın!",
           "english_sentence": "Your Majesty, I didn't mean to disrespect you, please forgive me!"
        },
        {
           "id": 1943,
           "turkish_word": "sayılmaz",
           "english_word": "doesn’t count",
           "type": "v",
           "turkish_sentence": "Senin oyun sayılmaz.",
           "english_sentence": "Your vote doesn’t count."
        },
        {
           "id": 1944,
           "turkish_word": "cep",
           "english_word": "pocket",
           "type": "n",
           "turkish_sentence": "Mehmet mektubu aldı ve ceb ine koydu.",
           "english_sentence": "Mehmet took the letter and put it in his pocket."
        },
        {
           "id": 1945,
           "turkish_word": "işin",
           "english_word": "your work / job",
           "type": "n",
           "turkish_sentence": "Yeni işin den memnun musun?",
           "english_sentence": "Are you happy with your new job ?"
        },
        {
           "id": 1946,
           "turkish_word": "Can",
           "english_word": "Can",
           "type": "n",
           "turkish_sentence": "Can işten atıldı.",
           "english_sentence": "Can got fired from his job.",
           "notes": "masculine name"
        },
        {
           "id": 1947,
           "turkish_word": "konuştum",
           "english_word": "I talked",
           "type": "v",
           "turkish_sentence": "Avukatımla telefonda konuştum.",
           "english_sentence": "I talked to my lawyer on the phone."
        },
        {
           "id": 1948,
           "turkish_word": "aradım",
           "english_word": "I called",
           "type": "v",
           "turkish_sentence": "Ofisi defalarca aradım.",
           "english_sentence": "I called the office several times."
        },
        {
           "id": 1949,
           "turkish_word": "Büşra",
           "english_word": "Büşra",
           "type": "n",
           "turkish_sentence": "Keşke Büşra partiye gelebilseydi.",
           "english_sentence": "If only Büşra had been able to come to the party.",
           "notes": "feminine name"
        },
        {
           "id": 1950,
           "turkish_word": "numaralı",
           "english_word": "number",
           "type": "adj",
           "turkish_sentence": "Yarışı 4 numaralı at kazandı.",
           "english_sentence": "The number 4 horse won the race."
        },
        {
           "id": 1951,
           "turkish_word": "fazlası",
           "english_word": "more",
           "type": "n",
           "turkish_sentence": "Hakettiğimden daha fazlası nı asla istemedim.",
           "english_sentence": "I have never wanted more than I deserve."
        },
        {
           "id": 1952,
           "turkish_word": "tanrının",
           "english_word": "God’s",
           "type": "poss",
           "turkish_sentence": "Agnostik insanlar tanrının varlığına dair bir kanıt olmadığına inanırlar.",
           "english_sentence": "Agnostic people believe that there is no proof of God’s existence."
        },
        {
           "id": 1953,
           "turkish_word": "saldırı",
           "english_word": "attack",
           "type": "n",
           "turkish_sentence": "Orta Doğu’daki bombalı saldırı lardan dolayı birçok sivil hayatını kaybetti.",
           "english_sentence": "Lots of civilians died because of bomb attacks in the Middle East."
        },
        {
           "id": 1954,
           "turkish_word": "işten",
           "english_word": "from work",
           "type": "adv",
           "turkish_sentence": "İşten erken çıkıp eve geldim.",
           "english_sentence": "I got home from work early."
        },
        {
           "id": 1955,
           "turkish_word": "hayatımın",
           "english_word": "of my life",
           "type": "n",
           "turkish_sentence": "Hayatımın her dakikasını kocamla geçirdim.",
           "english_sentence": "I have spent every moment of my life with my husband."
        },
        {
           "id": 1956,
           "turkish_word": "gelebilir",
           "english_word": "may/can come",
           "type": "v",
           "turkish_sentence": "Misafirimiz yarın gelebilir.",
           "english_sentence": "Our guest may come tomorrow."
        },
        {
           "id": 1957,
           "turkish_word": "aşağıda",
           "english_word": "down",
           "type": "adv",
           "turkish_sentence": "Her yeri aradık, aşağıda hiçbir şey yok.",
           "english_sentence": "We have searched everywhere, there is nothing down there."
        },
        {
           "id": 1958,
           "turkish_word": "Emre",
           "english_word": "Emre",
           "type": "n",
           "turkish_sentence": "Emre kendini iyi hissetmiyor.",
           "english_sentence": "Emre doesn’t feel well.",
           "notes": "masculine name"
        },
        {
           "id": 1959,
           "turkish_word": "domuz",
           "english_word": "pig",
           "type": "n",
           "turkish_sentence": "Minik domuz unu veterinere götürdü.",
           "english_sentence": "She took her little pig to a vet."
        },
        {
           "id": 1960,
           "turkish_word": "adil",
           "english_word": "fair",
           "type": "adj",
           "turkish_sentence": "Herkes bilir ki hayat adil değildir.",
           "english_sentence": "Everyone knows that life is not fair."
        },
        {
           "id": 1961,
           "turkish_word": "öldürdün",
           "english_word": "you killed",
           "type": "v",
           "turkish_sentence": "Babanı neden öldürdün ?",
           "english_sentence": "Why did you kill your father?"
        },
        {
           "id": 1962,
           "turkish_word": "topu",
           "english_word": "the ball",
           "type": "n",
           "turkish_sentence": "Futbolcu topu taca attı.",
           "english_sentence": "The soccer player threw the ball out of bounds."
        },
        {
           "id": 1963,
           "turkish_word": "yaptığımı",
           "english_word": "what I do/did",
           "type": "ptcp",
           "turkish_sentence": "Onu görünce ne yaptığımı bilmek ister misin?",
           "english_sentence": "Do you want to know what I did when I saw her?"
        },
        {
           "id": 1964,
           "turkish_word": "diyeceğim",
           "english_word": "I will tell",
           "type": "v",
           "turkish_sentence": "Sana bir şey diyeceğim.",
           "english_sentence": "I will tell you something."
        },
        {
           "id": 1965,
           "turkish_word": "top",
           "english_word": "ball",
           "type": "n",
           "turkish_sentence": "Top çok ağır.",
           "english_sentence": "The ball is quite heavy."
        },
        {
           "id": 1966,
           "turkish_word": "süredir",
           "english_word": "for {time}",
           "type": "adv",
           "turkish_sentence": "Bir yıldan fazla süredir bu işi yapıyorum.",
           "english_sentence": "I have been doing this job for more than a year."
        },
        {
           "id": 1967,
           "turkish_word": "söylemedim",
           "english_word": "I didn’t tell",
           "type": "v",
           "turkish_sentence": "Bu benim hatam, her şeyi biliyordum ama sana söylemedim.",
           "english_sentence": "It’s my fault, I knew everything, but I didn’t tell you."
        },
        {
           "id": 1968,
           "turkish_word": "memur",
           "english_word": "officer",
           "type": "n",
           "turkish_sentence": "Memur, birinin kefaletimi ödediğini söyledi ama kimin yaptığını bilmiyorum.",
           "english_sentence": "The officer told me that someone bailed me out, but I don't know who did that."
        },
        {
           "id": 1969,
           "turkish_word": "sor",
           "english_word": "ask",
           "type": "v",
           "turkish_sentence": "Hadi bir oyun oynayalım. Bana bir soru sor.",
           "english_sentence": "Let’s play a game. Ask me a question."
        },
        {
           "id": 1970,
           "turkish_word": "başlayalım",
           "english_word": "let’s begin",
           "type": "v",
           "turkish_sentence": "Toplantıya başlayalım.",
           "english_sentence": "Let’s begin the meeting."
        },
        {
           "id": 1971,
           "turkish_word": "ismi",
           "english_word": "his/her/its name",
           "type": "n",
           "turkish_sentence": "Onun tam ismi ni bilmiyorum.",
           "english_sentence": "I don’t know his full name."
        },
        {
           "id": 1972,
           "turkish_word": "gibisin",
           "english_word": "you are like",
           "type": "postp",
           "turkish_sentence": "Çölün ortasındaki serap gibisin.",
           "english_sentence": "You are like a mirage in a desert."
        },
        {
           "id": 1973,
           "turkish_word": "sevdiğim",
           "english_word": "that I like",
           "type": "ptcp",
           "turkish_sentence": "Sevdiğim insanları incitmek istemiyorum.",
           "english_sentence": "I don’t want to hurt people that I like."
        },
        {
           "id": 1974,
           "turkish_word": "başı",
           "english_word": "his/her head",
           "type": "n",
           "turkish_sentence": "Başı nı yastığa gömdü ve ağlamaya başladı.",
           "english_sentence": "He buried his head into the pillow and started crying."
        },
        {
           "id": 1975,
           "turkish_word": "bahse",
           "english_word": "to bet",
           "type": "adv",
           "turkish_sentence": "Bahse girerim herkes dün olan olayı konuşuyor.",
           "english_sentence": "I bet everyone is talking about the incident that happened yesterday.",
           "notes": "used with a verb"
        },
        {
           "id": 1976,
           "turkish_word": "şans",
           "english_word": "chance",
           "type": "n",
           "turkish_sentence": "Onun bu ülkeden kaçma şans ı hala var.",
           "english_sentence": "He still has a chance to escape from this country."
        },
        {
           "id": 1977,
           "turkish_word": "deme",
           "english_word": "don’t tell",
           "type": "v",
           "turkish_sentence": "Fatma’ya bunun hakkında bir şey deme lütfen.",
           "english_sentence": "Don’t tell Fatma anything about it please."
        },
        {
           "id": 1978,
           "turkish_word": "evden",
           "english_word": "from home",
           "type": "adv",
           "turkish_sentence": "Evden okula tüm yolu yürümek çok zor.",
           "english_sentence": "It is so hard to walk all the way to school from home."
        },
        {
           "id": 1979,
           "turkish_word": "söylediğim",
           "english_word": "that I said",
           "type": "ptcp",
           "turkish_sentence": "Söylememem gereken şeyler söylediğim için özür dilemek istiyorum.",
           "english_sentence": "I want to apologize for things that I said that I shouldn't have."
        },
        {
           "id": 1980,
           "turkish_word": "söylemek",
           "english_word": "to tell",
           "type": "v",
           "turkish_sentence": "Onlara gerçeği söyleme ye utanıyorum.",
           "english_sentence": "I am ashamed to tell them the truth."
        },
        {
           "id": 1981,
           "turkish_word": "yapın",
           "english_word": "do",
           "type": "v",
           "turkish_sentence": "Dediklerimi hemen yapın !",
           "english_sentence": "Just do what I say!"
        },
        {
           "id": 1982,
           "turkish_word": "bilmiyoruz",
           "english_word": "we don’t know",
           "type": "v",
           "turkish_sentence": "Bu adamın nereden geldiğini bilmiyoruz.",
           "english_sentence": "We don’t know where this guy came from."
        },
        {
           "id": 1983,
           "turkish_word": "kenara",
           "english_word": "aside",
           "type": "adv",
           "turkish_sentence": "Beni bir kenara çekip çocukluğunu anlatmaya başladı.",
           "english_sentence": "He took me aside and began to talk about his childhood."
        },
        {
           "id": 1984,
           "turkish_word": "izin",
           "english_word": "permission",
           "type": "n",
           "turkish_sentence": "Müdürün odasına izin siz giremezsin.",
           "english_sentence": "You can’t enter the manager’s room without permission."
        },
        {
           "id": 1985,
           "turkish_word": "Burak",
           "english_word": "Burak",
           "type": "n",
           "turkish_sentence": "Burak sigarayı bırakmaya çalışıyor.",
           "english_sentence": "Burak is trying to quit smoking.",
           "notes": "masculine name"
        },
        {
           "id": 1986,
           "turkish_word": "Yağmur",
           "english_word": "Yağmur",
           "type": "n",
           "turkish_sentence": "Yağmur ikiz kardeşi için bir elbise aldı.",
           "english_sentence": "Yağmur bought a dress for her twin sister.",
           "notes": "feminine name"
        },
        {
           "id": 1987,
           "turkish_word": "Alman",
           "english_word": "German",
           "type": "n",
           "turkish_sentence": "O bir Alman subayına aşık oldu.",
           "english_sentence": "She fell in love with a German officer."
        },
        {
           "id": 1988,
           "turkish_word": "ışık",
           "english_word": "light",
           "type": "n",
           "turkish_sentence": "Kardeşim karanlıktan korktuğu için uyurken ışık ları açık bırakıyor.",
           "english_sentence": "My brother leaves the lights on while sleeping because he is afraid of the dark."
        },
        {
           "id": 1989,
           "turkish_word": "kulağa",
           "english_word": "to ear",
           "type": "adv",
           "turkish_sentence": "Ses dalgaları önce dış kulağa girer.",
           "english_sentence": "Sound waves enter to the outer ear first."
        },
        {
           "id": 1990,
           "turkish_word": "istedin",
           "english_word": "you wanted",
           "type": "v",
           "turkish_sentence": "İşlerin bu kadar kötüye gitmesini sen istedin.",
           "english_sentence": "You wanted things to get this bad."
        },
        {
           "id": 1991,
           "turkish_word": "zevk",
           "english_word": "pleasure",
           "type": "n",
           "turkish_sentence": "Sizinle çalışmak bir zevk ti.",
           "english_sentence": "It was a pleasure to work with you."
        },
        {
           "id": 1992,
           "turkish_word": "kurban",
           "english_word": "sacrifice; victim",
           "type": "n",
           "turkish_sentence": "Genç kız, soğukkanlı bir katilin kurban ıydı.",
           "english_sentence": "The young girl was the victim of a cold-blooded murderer."
        },
        {
           "id": 1993,
           "turkish_word": "ettik",
           "english_word": "we did",
           "type": "aux",
           "turkish_sentence": "Tüm gece dans ettik.",
           "english_sentence": "We danced all night.",
           "notes": "auxilary verb used with nouns"
        },
        {
           "id": 1994,
           "turkish_word": "başla",
           "english_word": "start",
           "type": "v",
           "turkish_sentence": "Gözlerini kapat ve saymaya başla, ben saklanacağım.",
           "english_sentence": "Close your eyes and start counting, I will hide."
        },
        {
           "id": 1995,
           "turkish_word": "etmem",
           "english_word": "I don’t",
           "type": "aux",
           "turkish_sentence": "Ben barıştan yanayım, insanlarla kavga etmem.",
           "english_sentence": "I seek peace, I don’t fight with people.",
           "notes": "auxilary verb used with nouns"
        },
        {
           "id": 1996,
           "turkish_word": "zamanında",
           "english_word": "in time",
           "type": "adv",
           "turkish_sentence": "Oraya zamanında varmak istedik ama trafikte sıkıştık.",
           "english_sentence": "We wanted to be there in time, but we were stuck in the traffic."
        },
        {
           "id": 1997,
           "turkish_word": "yüzü",
           "english_word": "your/his/her face",
           "type": "n",
           "turkish_sentence": "Bebek o kadar tatlıydı ki bütün yüzü nü öptüm.",
           "english_sentence": "The baby was so cute that I kissed her all over her face."
        },
        {
           "id": 1998,
           "turkish_word": "gelmez",
           "english_word": "won’t come",
           "type": "v",
           "turkish_sentence": "Konsere giderken onu aradık ama bence gelmez.",
           "english_sentence": "We have called him on the way to the concert, but I think he won't come."
        },
        {
           "id": 1999,
           "turkish_word": "oturun",
           "english_word": "sit",
           "type": "v",
           "turkish_sentence": "Siz burada oturun, biz bir saat içinde geleceğiz.",
           "english_sentence": "You guys sit here, we'll come in an hour."
        },
        {
           "id": 2000,
           "turkish_word": "kızgın",
           "english_word": "angry",
           "type": "adj",
           "turkish_sentence": "Bana kızgın mısın?",
           "english_sentence": "Are you angry with me?"
        }
     ];

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

    // (89:4) {:else}
    function create_else_block$1(ctx) {
    	let span;
    	let t_value = /*span*/ ctx[16] + "";
    	let t;

    	const block = {
    		c: function create() {
    			span = element("span");
    			t = text(t_value);
    			add_location(span, file$3, 89, 8, 2958);
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
    		source: "(89:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (77:4) {#if span.toLowerCase() === word.toLowerCase()}
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
    			add_location(input, file$3, 77, 8, 2602);
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
    		source: "(77:4) {#if span.toLowerCase() === word.toLowerCase()}",
    		ctx
    	});

    	return block;
    }

    // (76:0) {#each spanList as span}
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
    		source: "(76:0) {#each spanList as span}",
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

    	function handleSubmit(event) {
    		if (event.key === 'Enter') {
    			if (word.toLowerCase() === answer.toLowerCase()) {
    				document.querySelector(".correct-tick").innerHTML = "&#x2714;";
    				document.querySelector(".correct-tick").style.color = "green";
    				document.querySelector(".text-input").style.color = "green";
    				document.querySelector(".text-input").style.backgroundColor = "white";
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
    				document.querySelector(".correct-tick").innerHTML = "&#x2716;";
    				document.querySelector(".correct-tick").style.color = "darkred";
    				document.querySelector(".text-input").style.color = "darkred";
    				document.querySelector(".text-input").style.backgroundColor = "white";

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
    const file$2 = "src\\components\\WordDetails.svelte";

    // (25:4) {#if wordObj.notes}
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
    			add_location(br, file$2, 25, 28, 799);
    			attr_dev(p, "class", "notes svelte-ezga6w");
    			add_location(p, file$2, 25, 4, 775);
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
    		source: "(25:4) {#if wordObj.notes}",
    		ctx
    	});

    	return block;
    }

    // (19:4) <Card>
    function create_default_slot(ctx) {
    	let p0;
    	let targetsentence;
    	let t0;
    	let span;
    	let t1;
    	let p1;
    	let t2_value = /*wordObj*/ ctx[1].type + "";
    	let t2;
    	let t3;
    	let hr;
    	let t4;
    	let p2;
    	let t5_value = /*wordObj*/ ctx[1].english_word + "";
    	let t5;
    	let t6;
    	let p3;
    	let t7_value = /*wordObj*/ ctx[1].english_sentence + "";
    	let t7;
    	let t8;
    	let t9;
    	let button0;
    	let t11;
    	let button1;
    	let t13;
    	let p4;
    	let t14;
    	let t15_value = /*wordObj*/ ctx[1].id + "";
    	let t15;
    	let t16;
    	let t17_value = /*wordObj*/ ctx[1].turkish_word + "";
    	let t17;
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
    			t0 = space();
    			span = element("span");
    			t1 = space();
    			p1 = element("p");
    			t2 = text(t2_value);
    			t3 = space();
    			hr = element("hr");
    			t4 = space();
    			p2 = element("p");
    			t5 = text(t5_value);
    			t6 = space();
    			p3 = element("p");
    			t7 = text(t7_value);
    			t8 = space();
    			if (if_block) if_block.c();
    			t9 = space();
    			button0 = element("button");
    			button0.textContent = "Previous";
    			t11 = space();
    			button1 = element("button");
    			button1.textContent = "Next";
    			t13 = space();
    			p4 = element("p");
    			t14 = text("debug------");
    			t15 = text(t15_value);
    			t16 = space();
    			t17 = text(t17_value);
    			attr_dev(span, "class", "correct-tick svelte-ezga6w");
    			add_location(span, file$2, 19, 88, 532);
    			attr_dev(p0, "class", "target-sentence svelte-ezga6w");
    			add_location(p0, file$2, 19, 4, 448);
    			attr_dev(p1, "class", "word-type svelte-ezga6w");
    			add_location(p1, file$2, 20, 4, 576);
    			add_location(hr, file$2, 21, 4, 621);
    			attr_dev(p2, "class", "source-word svelte-ezga6w");
    			add_location(p2, file$2, 22, 4, 631);
    			attr_dev(p3, "class", "source-sentence svelte-ezga6w");
    			add_location(p3, file$2, 23, 4, 687);
    			attr_dev(button0, "class", "previous-button svelte-ezga6w");
    			add_location(button0, file$2, 27, 4, 840);
    			attr_dev(button1, "class", "next-button svelte-ezga6w");
    			add_location(button1, file$2, 28, 4, 960);
    			attr_dev(p4, "class", "svelte-ezga6w");
    			add_location(p4, file$2, 29, 4, 1095);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p0, anchor);
    			mount_component(targetsentence, p0, null);
    			append_dev(p0, t0);
    			append_dev(p0, span);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p1, anchor);
    			append_dev(p1, t2);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, hr, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, p2, anchor);
    			append_dev(p2, t5);
    			insert_dev(target, t6, anchor);
    			insert_dev(target, p3, anchor);
    			append_dev(p3, t7);
    			insert_dev(target, t8, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t11, anchor);
    			insert_dev(target, button1, anchor);
    			insert_dev(target, t13, anchor);
    			insert_dev(target, p4, anchor);
    			append_dev(p4, t14);
    			append_dev(p4, t15);
    			append_dev(p4, t16);
    			append_dev(p4, t17);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler*/ ctx[3], false, false, false),
    					listen_dev(button1, "click", /*click_handler_1*/ ctx[4], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			const targetsentence_changes = {};
    			if (dirty & /*wordObj*/ 2) targetsentence_changes.wordObj = /*wordObj*/ ctx[1];
    			targetsentence.$set(targetsentence_changes);
    			if ((!current || dirty & /*wordObj*/ 2) && t2_value !== (t2_value = /*wordObj*/ ctx[1].type + "")) set_data_dev(t2, t2_value);
    			if ((!current || dirty & /*wordObj*/ 2) && t5_value !== (t5_value = /*wordObj*/ ctx[1].english_word + "")) set_data_dev(t5, t5_value);
    			if ((!current || dirty & /*wordObj*/ 2) && t7_value !== (t7_value = /*wordObj*/ ctx[1].english_sentence + "")) set_data_dev(t7, t7_value);

    			if (/*wordObj*/ ctx[1].notes) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.m(t9.parentNode, t9);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if ((!current || dirty & /*wordObj*/ 2) && t15_value !== (t15_value = /*wordObj*/ ctx[1].id + "")) set_data_dev(t15, t15_value);
    			if ((!current || dirty & /*wordObj*/ 2) && t17_value !== (t17_value = /*wordObj*/ ctx[1].turkish_word + "")) set_data_dev(t17, t17_value);
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
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(hr);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(p2);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(p3);
    			if (detaching) detach_dev(t8);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t11);
    			if (detaching) detach_dev(button1);
    			if (detaching) detach_dev(t13);
    			if (detaching) detach_dev(p4);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(19:4) <Card>",
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

    			if (dirty & /*$$scope, wordObj, activeId*/ 35) {
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

    function instance$2($$self, $$props, $$invalidate) {
    	let wordObj;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('WordDetails', slots, []);
    	let activeId = 1;
    	activeId = 20; // <-----------DEBUG

    	function handleSuccess() {
    		$$invalidate(0, activeId++, activeId);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<WordDetails> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => $$invalidate(0, activeId = activeId - 1 < 1 ? 1 : activeId - 1);

    	const click_handler_1 = () => $$invalidate(0, activeId = activeId + 1 > words.length
    	? words.length
    	: activeId + 1);

    	$$self.$capture_state = () => ({
    		words,
    		Card,
    		TargetSentence,
    		activeId,
    		handleSuccess,
    		wordObj
    	});

    	$$self.$inject_state = $$props => {
    		if ('activeId' in $$props) $$invalidate(0, activeId = $$props.activeId);
    		if ('wordObj' in $$props) $$invalidate(1, wordObj = $$props.wordObj);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*activeId*/ 1) {
    			$$invalidate(1, wordObj = words.find(word => word.id == activeId));
    		}
    	};

    	return [activeId, wordObj, handleSuccess, click_handler, click_handler_1];
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

    const { Object: Object_1 } = globals;
    const file$1 = "src\\components\\CharacterButtons.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	return child_ctx;
    }

    // (23:4) {:else}
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
    			attr_dev(button, "class", "svelte-1unl5b2");
    			add_location(button, file$1, 23, 8, 731);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "mousedown", prevent_default(/*mousedown_handler_1*/ ctx[4]), false, true, false),
    					listen_dev(button, "click", prevent_default(click_handler_1), false, true, false)
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
    		source: "(23:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (21:4) {#if is_shift}
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
    			attr_dev(button, "class", "svelte-1unl5b2");
    			add_location(button, file$1, 21, 8, 581);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "mousedown", prevent_default(/*mousedown_handler*/ ctx[3]), false, true, false),
    					listen_dev(button, "click", prevent_default(click_handler), false, true, false)
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
    		source: "(21:4) {#if is_shift}",
    		ctx
    	});

    	return block;
    }

    // (20:0) {#each characterList as character}
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
    		source: "(20:0) {#each characterList as character}",
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
    			if (dirty & /*handleClick, characterList, is_shift*/ 7) {
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
    			document.querySelector(".text-input").value += character.character.toUpperCase();
    		} else {
    			document.querySelector(".text-input").value += character.character;
    		}
    	};

    	const writable_props = ['is_shift'];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<CharacterButtons> was created with unknown prop '${key}'`);
    	});

    	function mousedown_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	function mousedown_handler_1(event) {
    		bubble.call(this, $$self, event);
    	}

    	const click_handler = character => handleClick({ character });
    	const click_handler_1 = character => handleClick({ character });

    	$$self.$$set = $$props => {
    		if ('is_shift' in $$props) $$invalidate(0, is_shift = $$props.is_shift);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		dispatch,
    		is_shift,
    		characterList,
    		characterMap,
    		handleClick
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
    		mousedown_handler,
    		mousedown_handler_1,
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
    			console.warn("<CharacterButtons> was created without expected prop 'is_shift'");
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
