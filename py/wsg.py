#!/usr/bin/env python
# -*- coding: utf-8 -*-
 
# Copyright 2014 Sebastien Bechet
 
#  This program is free software: you can redistribute it and/or modify
#  it under the terms of the GNU General Public License Version 3 as
#  published by the Free Software Foundation.
#
#  This program is distributed in the hope that it will be useful,
#  but WITHOUT ANY WARRANTY; without even the implied warranty of
#  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#  GNU General Public License for more details.
 
# [ms][Pac] WSG Sound Generator and more ....
# High Quality - version 20140714
 
# Thank you :
# Frederic Vecoven (frederic@vecoven.com) (http://www.vecoven.com/elec/pacman/pacman.html)
 
import array, wave, os
from wildcardman import MusicsAndEffects
 
# debug
#import pdb
# breakpoint: pdb.set_trace()
 
class Track(object):
    wave = 0
    frequency = 0
    voltype = 0
    volume = 0
    counter = 0
    accumulator = 0
 
    def __init__(self):
        self.counter = 0
        self.frequency = 0
        self.volume = 0
        self.voltype = 0
        self.accumulator = 0
 
    def volumeEffect(self):
        #if self.voltype == 0: # constant volume
        #    return self.volume
        if self.volume > 0:
            if self.voltype == 1: # decreasing volume
                self.volume -= 1
            elif self.voltype == 2: # -1 per 1/2 rate
                if self.counter%2:
                    self.volume -= 1
        self.counter += 1
        return self.volume
 
    def update(self):
        if self.volume == 0 or self.frequency == 0:
            self.accumulator = 0
 
    def isFinished(self):
        return False
 
class Effect(Track):
    def __init__(self, source):
        Track.__init__(self)
        # Data Effect (ro)
        self.duration = source[3]
        self.reverse = source[4]
        self.freqincrepeat = source[5]
        self.repeat = source[6]
        self.volinc = source[9]
        # Helper (rw)
        self.freqstart = source[1]
        self.freqinc = source[2]
        self.play = True
        self.pingpong = True
        self.curduration = self.duration
        # Track (rw)
        self.wave = source[0]
        self.frequency = self.freqstart
        self.voltype = source[7]
        self.volume = source[8]
 
    def update(self):
        Track.update(self)
        if not self.play:
            return False
 
        self.curduration -= 1;
        if self.curduration == 0:
            # duration is now 0, check repeat
            self.repeat -= 1
            if self.repeat <= 0:
                self.frequency = 0
                self.volume = 0
                self.play = False
                return False
            # duration is 0. Re-init it.
            self.curduration = self.duration
            # Reverse Frequency increment
            if self.reverse:
                self.freqinc = - self.freqinc
                self.pingpong = not self.pingpong
            if (not self.reverse) or self.pingpong:
                self.freqstart += self.freqincrepeat
                self.frequency = self.freqstart
                self.volume += self.volinc
 
        self.frequency += self.freqinc
        self.volumeEffect()
        return True
 
    def isFinished(self):
        return not self.play
 
class Music(Track):
    notes = {}
 
    def __init__(self, source):
        Track.__init__(self)
        # Data Effect (ro)
        self.data = source
        # Helper (rw)
        self.play = True
        self.duration = 1
        self.seek = 0
        # Track (rw)
        self.wave = 0
        self.frequency = 0
        self.voltype = 0
        self.volume = 0
        self.initNote()
 
    def initNote(self):
        # No Music
        k2 = '---'
        v2 = 0
        self.notes[k2] = v2
        for k, v in MusicsAndEffects.octave.items():
            k2 = k + '0'
            v2 = int(v / 8)
            self.notes[k2] = v2
            k2 = k + '1'
            v2 = int(v / 4)
            self.notes[k2] = v2
            k2 = k + '2'
            v2 = int(v / 2)
            self.notes[k2] = v2
            k2 = k + '3'
            v2 = int(v)
            self.notes[k2] = v2
            for i in (1, 2, 3, 4, 5, 6):
                k2 = k + str(i+3)
                v2 = int(v * pow(2,i))
                self.notes[k2] = v2
 
    def update(self):
        Track.update(self)
        if not self.play:
            return False
 
        #wave, note, duration (1/60 s), volume, volEffect
        self.duration -= 1
        if self.duration == 0:
            if self.seek >= len(self.data):
                self.play = False
                return False
            self.wave = self.data[self.seek][0]
            self.note = self.data[self.seek][1]
            self.duration = self.data[self.seek][2]
            self.volume = self.data[self.seek][3]
            self.voltype = self.data[self.seek][4]
            self.seek += 1
 
            self.frequency = self.notes[self.note]
 
        self.volumeEffect()
        return True
 
    def isFinished(self):
        return not self.play
 
#----------------------------------------------------------------------
class Wsg(object):
    def __init__(self, bank, outputFrequency):
        self.bank = bank
        self.count = 0
        self.outputFrequency = outputFrequency
        self.vblank = int(outputFrequency / 60)
        self.wavetable = MusicsAndEffects.wavetable
 
    def update(self,length):
        sequence = length * [0]
        better_size_is = 0   # real sequence length
        for track in self.bank:
            incr = track.frequency / self.outputFrequency
            wtab = self.wavetable[track.wave]
            for i in range(length):
                if track.isFinished():
                    break
                if self.count%self.vblank == 0:
                    track.update()
                    incr = track.frequency / self.outputFrequency
                if (track.volume != 0) and (track.frequency != 0):
                    seek = int(track.accumulator) % 32
                    sequence[i] += track.volume * wtab[abs(seek)]
                    track.accumulator += incr
                self.count += 1
            if i > better_size_is:
                better_size_is = i + 1
        return sequence[:better_size_is]
 
    def isFinished(self):
        finished = True;
        for track in self.bank:
            finished = track.isFinished() & finished
        return finished
#----------------------------------------------------------------------
class SoundWave(Wsg):
    wave_file = None
 
    def __init__(self, bank, outputFrequency, name):
        Wsg.__init__(self, bank, outputFrequency)
        # SHRT_MAX / (max(sample)*max(volume)*nbtrack)
        self.normalize = int((2**15) / (16*16*len(bank)))
        self.wave_file = wave.open(name + ".wav", "w")
        nchannels = 1
        sampwidth = 2
        framerate = outputFrequency
        nframes = 0 # this is a library problem, not my own
        comptype = "NONE"
        compname = "not compressed"
        self.wave_file.setparams((nchannels, sampwidth, framerate,
            nframes, comptype, compname))
 
    def __del__(self):
        self.wave_file.close()
 
    def update(self):
        seq = Wsg.update(self,4096)
        seq16 = [s * self.normalize for s in seq] # normalize
        seqb = array.array('h', seq16).tostring() # then in bytes()
        self.wave_file.writeframes(seqb)
 
def genEffect(destFreq):
    for name, data in MusicsAndEffects.effects.items():
        print("===" + name + "===")
        dname = 'waves/' + name
        e = []
        e.append(Effect(data))
        s = SoundWave(e, destFreq, dname)
        while not s.isFinished():
            seq = s.update()
 
def genMusic(destFreq):
    for name, tracks in MusicsAndEffects.musics.items():
        print("===" + name + "===")
        dname = 'waves/' + name
        m = []
        for track in tracks:
            m.append(Music(track))
        s = SoundWave(m, destFreq, dname)
        while not s.isFinished():
            seq = s.update()
 
if __name__ == '__main__':
    try:
        os.mkdir('waves')
    except OSError as e:
        print('wave/ : ', e.args)
    destFreq = 48000
    genEffect(destFreq)
    genMusic(destFreq)

