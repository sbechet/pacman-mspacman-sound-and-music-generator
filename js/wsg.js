// -*- coding: utf-8 -*-
// Copyright 2014 Sebastien Bechet

//  This program is free software: you can redistribute it and/or modify
//  it under the terms of the GNU General Public License Version 3 as
//  published by the Free Software Foundation.
//
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.

// [ms][Pac] WSG Sound Generator and more ....
// Javascript version 20140630

// Thank you :
// Frederic Vecoven (frederic@vecoven.com) (http://www.vecoven.com/elec/pacman/pacman.html)

///////////////////////////////////////////////////////////////////////
// Track

var Track = function(name) {
    this.name = name;
    this.wave = 0;
    this.frequency = 0;
    this.voltype = 0;
    this.volume = 0;
    this.counter = 0;
    this.accumulator = 0;
    this.play = false;
};

Track.prototype = {
    volumeEffect: function() {
        if (this.volume > 0) {
            if (this.voltype == 1) { // decreasing volume
                this.volume -= 1;
            } else {
                if (this.voltype == 2) { // -1 per 1/2 rate
                    if (this.counter % 2) {
                        this.volume -= 1;
                    }
                }
            }
        }
        this.counter += 1;
        return this.volume;
    },
    update: function() {
        if (this.volume == 0 || this.frequency == 0) {
            this.accumulator = 0;
        }
    },
    isFinished: function() {
        return ! this.play;
    }
};

///////////////////////////////////////////////////////////////////////
// Effect

var Effect = function(name, source) {
    Track.call(this, name);
    // Data Effect (ro)
    this.duration = source[3];
    this.reverse = source[4];
    this.freqincrepeat = source[5];
    this.repeat = source[6];
    this.volinc = source[9];
    // Helper (rw)
    this.freqstart = source[1];
    this.freqinc = source[2];
    this.play = true;
    this.pingpong = true;
    this.curduration = this.duration;
    // Track (rw)
    this.wave = source[0];
    this.frequency = this.freqstart;
    this.voltype = source[7];
    this.volume = source[8];
};

Effect.prototype = newChildObject(Track.prototype, {
    update: function() {
        Track.prototype.update.call(this);
        if (! this.play) {
            return false;
        }
        this.curduration -= 1;
        if (this.curduration == 0) {
            // duration is now 0, check repeat
            this.repeat -= 1;
            if (this.repeat <= 0) {
                this.frequency = 0;
                this.volume = 0;
                this.play = false;
                return false;
            }
            // duration is 0. Re-init it.
            this.curduration = this.duration;
            // Reverse Frequency increment
            if (this.reverse) {
                this.freqinc = - this.freqinc;
                this.pingpong = !this.pingpong;
            }
            if ( (!this.reverse) || this.pingpong) {
                this.freqstart += this.freqincrepeat;
                this.frequency = this.freqstart;
                this.volume += this.volinc;
            }
        }
        this.frequency += this.freqinc;
        Track.prototype.volumeEffect.call(this);
        return true;
    },
    isFinished: function() {
        return ! this.play;
    }
});

///////////////////////////////////////////////////////////////////////
// Music

var Music = function(name, source) {
    Track.call(this, name);
    // Data Effect (ro)
    this.data = source;
    // Helper (rw)
    this.play = true;
    this.duration = 1;
    this.seek = 0;
    // Track (rw)
    this.wave = 0;
    this.frequency = 0;
    this.voltype = 0;
    this.volume = 0;
    // initNote :
    var octave = [];
    // octave number 4 in real world
    octave["C-"] = Math.round(4*440/Math.pow(2,9/12));
    octave["C#"] = Math.round(4*440/Math.pow(2,8/12));
    octave["D-"] = Math.round(4*440/Math.pow(2,7/12)); 
    octave["D#"] = Math.round(4*440/Math.pow(2,6/12)); 
    octave["E-"] = Math.round(4*440/Math.pow(2,5/12));
    octave["F-"] = Math.round(4*440/Math.pow(2,4/12));
    octave["F#"] = Math.round(4*440/Math.pow(2,3/12));
    octave["G-"] = Math.round(4*440/Math.pow(2,2/12));
    octave["G#"] = Math.round(4*440/Math.pow(2,1/12));
    octave["A-"] = Math.round(4*440);
    octave["A#"] = Math.round(4*440*Math.pow(2,1/12));
    octave["B-"] = Math.round(4*440*Math.pow(2,2/12));
    this.notes = {};
    var k2, v2, v;
    // No Music
    k2 = '---';
    v2 = 0;
    this.notes[k2] = v2;
    for (var k in octave) {
        v = octave[k]
        k2 = k + '0';
        v2 = v / 8;
        this.notes[k2] = v2;
        k2 = k + '1';
        v2 = v / 4;
        this.notes[k2] = v2;
        k2 = k + '2';
        v2 = v / 2;
        this.notes[k2] = v2;
        k2 = k + '3';
        v2 = v;
        this.notes[k2] = v2;
        for (var i=1; i<6; i++) {
            k2 = k + (i+3).toString();
            v2 = v * Math.pow(2,i);
            this.notes[k2] = v2;
        }
    }
};

Music.prototype = newChildObject(Track.prototype, {
    update: function() {
        Track.prototype.update.call(this);
        if (! this.play) {
            return false;
        }
        //wave, note, duration (1/60 s), volume, volEffect
        this.duration -= 1;
        if (this.duration == 0) {
            if (this.seek >= this.data.length) {
                this.frequency = 0;
                this.volume = 0;
                this.play = false;
                return false;
            }
            this.wave = this.data[this.seek][0];
            this.note = this.data[this.seek][1];
            this.duration = this.data[this.seek][2];
            this.volume = this.data[this.seek][3];
            this.voltype = this.data[this.seek][4];
            this.seek += 1;
            this.frequency = this.notes[this.note];
        }
        Track.prototype.volumeEffect.call(this);
        return true
    },
    isFinished: function() {
        return ! this.play;
    }
});

///////////////////////////////////////////////////////////////////////
// Wsg

function Wsg(outputFrequency) {
    var wavetable = MusicsAndEffects.wavetable;
    var bank = [];
    var seqtrack = [];
    var count = 0;
    var outputFrequency = outputFrequency;
    var vblank = Math.round(outputFrequency / 60);

    this.update = function(e) {
        var sequence = e.outputBuffer.getChannelData(0);
        var len = sequence.length;

        // cleanup buffer (chromium)
        for (var i=0; i<len; i++) {
            sequence[i] = 0;
        }
        
        // remove old tracks
        for (var i=0; i<bank.length; i++) {
            var track = bank[i];
            if (track.isFinished()) {
                bank.splice(bank.indexOf(track),1);
            }
        }
        
        // add sequence
        if (bank.length == 0) {
            if (seqtrack.length != 0) {
                bank.push(seqtrack.shift());
            }
        }

        // fill samples
        for (var index=0; index<bank.length; index++) {
            var track = bank[index];
            var incr = track.frequency / outputFrequency;
            var wtab = wavetable[track.wave];
            for (var i=0; i<len; i++) {
                if (count % vblank == 0) {
                    if (track.isFinished()) {
                        break;
                    } else {
                        track.update();
                        incr = track.frequency / outputFrequency;
                    }
                }                
                if ( (track.volume != 0) || (track.frequency != 0) ) {
                    var seek = Math.floor(track.accumulator) % 32;
                    sequence[i] += track.volume * wtab[Math.abs(seek)];
                    track.accumulator += incr;
                }
                count += 1;
            }
        }
        
        // normalize [-1 ... 1] (volume and tracks number)
        if (bank.length != 0) {
            for (var i=0; i<len; i++) {
                sequence[i] /= (15*3); // divide by three voice, else sirens are too high
            }
        }
    }
    this.addTrack = function(track) {
        bank.push(track);
        return true;
    }
    
    this.addSeqTrack = function(track) {
        seqtrack.push(track);
    }

    this.resetSeqTrack = function(track) {
        seqtrack = [];
    }
    
    this.isFinished = function() {
        var finished = true;
        for (var index=0; index<bank.length; index++) {
            var track = bank[index];
            finished = track.isFinished() && finished;
        }
        return finished;
    }

    this.isPlaying = function(name) {
        // Test if already playing
        for (var i=0; i<bank.length; i++) {
            if (bank[i].name == name) {
                return true;
            }
        }
        return false;
    }

    // Correct samples for matching [-1 .. 1]
    for (var i=0; i<wavetable.length; i++) {
        for (var j=0; j<wavetable[i].length; j++) {
            wavetable[i][j] = ((wavetable[i][j]+8)/7.5) - 1;
        }
    }
    return this;
}


///////////////////////////////////////////////////////////////////////
// WebAudio API

getWsgOnWebAudio = function() {
    try {
        var audio_ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        alert("Sorry, html5 audio not supported.");
    }
    //~ var gain = audio_ctx.createGain();
    //~ gain.gain.value = 0.5;

    var wsg = new Wsg(audio_ctx.sampleRate);

    var processor = audio_ctx.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = wsg.update;
    processor.connect(audio_ctx.destination);
    //~ processor.connect(gain);
    //~ gain.connect(audio_ctx.destination);
    return wsg;
}

addMusic = function(name) {
    if (wsg.isPlaying(name)) {
        return;
    }
    var tracks=MusicsAndEffects.musics[name];
    for (var i=0; i<tracks.length; i++) {
        var track = tracks[i];
        var t = new Music(name, track);
        wsg.addTrack(t);
    }
}

addEffect = function(name) {
    if (wsg.isPlaying(name)) {
        return;
    }
    var effect=MusicsAndEffects.effects[name];
    var t = new Effect(name, effect);
    wsg.addTrack(t);
}

addSeqEffect = function(name) {
    var effect=MusicsAndEffects.effects[name];
    var t = new Effect(name, effect);
    wsg.addSeqTrack(t);
}

addNewSeqEffect = function(name) {
    wsg.resetSeqTrack();
    addSeqEffect(name);
}
