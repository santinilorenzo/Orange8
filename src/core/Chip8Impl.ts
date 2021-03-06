import { Bus } from '../bus/Bus';
import { IDLEEvent } from '../bus/events/IDLEEvent';
import { Fetcher } from '../fetch/Fetcher';
import { FetcherImpl } from '../fetch/FetcherImpl';
import { ADD_VxByte } from '../instructionSet/ADD_VxByte';
import { ADD_VxVy } from '../instructionSet/ADD_VxVy';
import { AND_VxVy } from '../instructionSet/AND_VxVy';
import { Instruction } from '../instructionSet/API/Instruction';
import { CALL } from '../instructionSet/CALL';
import { CLS } from '../instructionSet/CLS';
import { DRW_VxVyNibble } from '../instructionSet/DRW_VxVyNibble';
import { JP } from '../instructionSet/JP';
import { JP_V0addr } from '../instructionSet/JP_V0addr';
import { LD_Iaddr } from '../instructionSet/LD_Iaddr';
import { LD_VxByte } from '../instructionSet/LD_VxByte';
import { LD_VxK } from '../instructionSet/LD_VxK';
import { LD_VxVy } from '../instructionSet/LD_VxVy';
import { OR_VxVy } from '../instructionSet/OR_VxVy';
import { RET } from '../instructionSet/RET';
import { RND_VxByte } from '../instructionSet/RND_VxByte';
import { SE_VxByte } from '../instructionSet/SE_VxByte';
import { SE_VxVy } from '../instructionSet/SE_VxVy';
import { SHL_Vx } from '../instructionSet/SHL_Vx';
import { SHR_Vx } from '../instructionSet/SHR_Vx';
import { SKNP_Vx } from '../instructionSet/SKNP_Vx';
import { SKP_Vx } from '../instructionSet/SKP_Vx';
import { SNE_VxByte } from '../instructionSet/SNE_VxByte';
import { SNE_VxVy } from '../instructionSet/SNE_VxVy';
import { SUBN_VxVy } from '../instructionSet/SUBN_VxVy';
import { SUB_VxVy } from '../instructionSet/SUB_VxVy';
import { XOR_VxVy } from '../instructionSet/XOR_VxVy';
import { Chip8StateBuilderImpl } from '../utils/Chip8StateBuilderImpl';
import { Constants } from '../utils/Constants';
import { RESUMEEvent } from './../bus/events/RESUMEEvent';
import { ADD_IVx } from './../instructionSet/ADD_IVx';
import { IDLE } from './../instructionSet/custom/IDLE';
import { LD_AllRegsVx } from './../instructionSet/LD_AllRegsVx';
import { LD_BVx } from './../instructionSet/LD_BVx';
import { LD_DTVx } from './../instructionSet/LD_DTVx';
import { LD_FVx } from './../instructionSet/LD_FVx';
import { LD_STVx } from './../instructionSet/LD_STVx';
import { LD_VxAllRegs } from './../instructionSet/LD_VxAllReg';
import { LD_VxDT } from './../instructionSet/LD_VxDT';
import { Chip8 } from './Chip8';
import { Chip8state } from './Chip8State';
import { FontsetLoader } from './FontsetLoader';

export class Chip8Impl implements Chip8 {

    private chip8State: Chip8state
    private fetcher: Fetcher
    private bus: Bus
    private static readonly randomStrategy = () => Math.round(Math.random() * 255)
    private idle: boolean

    constructor(bus: Bus) {
        this.fetcher = new FetcherImpl()
        this.chip8State = new Chip8state()
        this.bus = bus
    }

    public bootstrap(): void {
        this.bus.subscribe(IDLEEvent.ID, () => { this.idle = true })
        this.bus.subscribe(RESUMEEvent.ID, () => { this.idle = false })
        const ram = new Array<number>(Constants.RAM_SIZE);
        const scr = new Array<number>(Constants.SCREEN_PIXELS);
        const stack = new Array<number>(Constants.STACK_SIZE);
        const v = new Array<number>(Constants.NUMBER_OF_GENERAL_REGISTERS);
        this.chip8State = new Chip8StateBuilderImpl()
            .ram(this.initArray(ram))
            .stack(this.initArray(stack))
            .v(this.initArray(v))
            .sp(0)
            .ip(Constants.FIRST_RAM_AVAILABLE_ADDRESS)
            .i(0)
            .scr(this.initArray(scr))
            .delay(0)
            .sound(0)
            .opcode(0)
            .build()
        FontsetLoader.load(ram)
        this.idle = false
    }

    initArray(arr: Array<number>) {
        for (let i = 0; i < arr.length; i++) {
            arr[i] = 0
        }
        return arr
    }

    public loadRom(rom: Uint8Array) {
        for (let i = 0; i < rom.length; i++) {
            this.chip8State.ram[Constants.FIRST_RAM_AVAILABLE_ADDRESS + i] = rom[i]
        }
    }

    public handleTimers(){
        if (this.chip8State.delay > 0) {
            this.chip8State.delay -= 1
        }

        if (this.chip8State.sound > 0) {
            this.chip8State.sound -= 1
        }
    }

    public fetch(): void {
        if (this.idle) {
            return
        }
        const ip = this.chip8State.ip
        const ram = this.chip8State.ram
        this.chip8State.opcode = this.fetcher.fetch(ip, ram)
    }

    public decode(): Instruction {
        if (this.idle) {
            return new IDLE(this.chip8State)
        }
        // Instruction pointer to the next instruction
        this.chip8State.ip += 2;

        let maskFormat: number = 0xF000;
        let format: number = (this.chip8State.opcode & maskFormat) >> 12;

        let opcode = this.chip8State.opcode

        switch (format) {
            case 0x0:
                let mask0 = 0x00FF;
                let format0 = opcode & mask0;
                switch (format0) {
                    case 0xE0:
                        return new CLS(this.chip8State)
                    case 0xEE:
                        return new RET(this.chip8State)
                }
            case 0x1:
                let mask1Jump = 0x0FFF
                let jumpTo = opcode & mask1Jump
                return new JP(this.chip8State, jumpTo)
            case 0x2:
                let mask2Call = 0x0FFF
                let callAddr = opcode & mask2Call
                return new CALL(this.chip8State, callAddr)
            case 0x3:
                let mask3vx = 0x0F00
                let vx_0x3 = (opcode & mask3vx) >> 8
                let mask3kk = 0x00FF
                let kk_0x3 = opcode & mask3kk
                return new SE_VxByte(this.chip8State, vx_0x3, kk_0x3)
            case 0x4:
                let mask4vx = 0x0F00
                let vx_0x4 = (opcode & mask4vx) >> 8
                let mask4kk = 0x00FF
                let kk_0x4 = opcode & mask4kk
                return new SNE_VxByte(this.chip8State, vx_0x4, kk_0x4)
            case 0x5:
                let mask5x = 0x0F00
                let vx_0x5 = (opcode & mask5x) >> 8
                let mask5y = 0x00F0
                let vy_0x5 = (opcode & mask5y) >> 4
                return new SE_VxVy(this.chip8State, vx_0x5, vy_0x5)
            case 0x6:
                let mask6x = 0x0F00
                let vx_0x6 = (opcode & mask6x) >> 8
                let mask6_kk = 0x00FF
                let kk_0x6 = opcode & mask6_kk
                return new LD_VxByte(this.chip8State, vx_0x6, kk_0x6)
            case 0x7:
                let mask7x = 0x0F00
                let vx_0x7 = (opcode & mask7x) >> 8
                let mask7_kk = 0x00FF
                let kk_0x7 = opcode & mask7_kk
                return new ADD_VxByte(this.chip8State, vx_0x7, kk_0x7)
            case 0x8:
                let mask8 = 0x000F;
                let format8 = opcode & mask8;
                let mask8x = 0x0F00
                let mask8y = 0x00F0
                let vx_0x8_0x0 = (opcode & mask8x) >> 8
                let vy_0x8_0x0 = (opcode & mask8y) >> 4
                switch (format8) {
                    case 0x0:
                        return new LD_VxVy(this.chip8State, vx_0x8_0x0, vy_0x8_0x0)
                    case 0x1:
                        return new OR_VxVy(this.chip8State, vx_0x8_0x0, vy_0x8_0x0)
                    case 0x2:
                        return new AND_VxVy(this.chip8State, vx_0x8_0x0, vy_0x8_0x0)
                    case 0x3:
                        return new XOR_VxVy(this.chip8State, vx_0x8_0x0, vy_0x8_0x0)
                    case 0x4:
                        return new ADD_VxVy(this.chip8State, vx_0x8_0x0, vy_0x8_0x0)
                    case 0x5:
                        return new SUB_VxVy(this.chip8State, vx_0x8_0x0, vy_0x8_0x0)
                    case 0x6:
                        return new SHR_Vx(this.chip8State, vx_0x8_0x0, vy_0x8_0x0)
                    case 0x7:
                        return new SUBN_VxVy(this.chip8State, vx_0x8_0x0, vy_0x8_0x0)
                    case 0xE:
                        return new SHL_Vx(this.chip8State, vx_0x8_0x0)
                }
                break;
            case 0x9:
                let mask9x = 0x0F00
                let mask9y = 0x00F0
                let vx_0x9 = (opcode & mask9x) >> 8
                let vy_0x9 = (opcode & mask9y) >> 4
                return new SNE_VxVy(this.chip8State, vx_0x9, vy_0x9)
            case 0xA:
                let maskA = 0x0FFF
                let addrA = opcode & maskA
                return new LD_Iaddr(this.chip8State, addrA)
            case 0xB:
                let maskB = 0x0FFF
                let addrB = opcode & maskB
                return new JP_V0addr(this.chip8State, addrB)
            case 0xC:
                let maskCx = 0x0F00
                let maskCkk = 0x00FF
                let vx_0xc = (opcode & maskCx) >> 8
                let kk_0xc = (opcode & maskCkk)
                return new RND_VxByte(this.chip8State, vx_0xc, kk_0xc, Chip8Impl.randomStrategy);
            case 0xD:
                let maskDx = 0x0F00
                let maskDy = 0x00F0
                let maskDn = 0x000F
                let vx_0xd = (opcode & maskDx) >> 8
                let vy_0xd = (opcode & maskDy) >> 4
                let n_0xd = opcode & maskDn
                return new DRW_VxVyNibble(this.bus, this.chip8State, vx_0xd, vy_0xd, n_0xd)
            case 0xE:
                let maskE = 0x00FF;
                let formatE = opcode & maskE
                let maskEx = 0x0F00
                let vx_0xE = (opcode & maskEx) >> 8
                switch (formatE) {
                    case 0x9E:
                        return new SKP_Vx(this.bus, this.chip8State, vx_0xE)
                    case 0xA1:
                        return new SKNP_Vx(this.bus, this.chip8State, vx_0xE)
                }
                break;
            case 0xF:
                let maskF = 0x00FF;
                let formatF = opcode & maskF;
                let maskFx = 0x0F00
                let vx_0xF = (opcode & maskFx) >> 8
                switch (formatF) {
                    case 0x07:
                        return new LD_VxDT(this.chip8State, vx_0xF)
                    case 0x0A:
                        return new LD_VxK(this.bus, this.chip8State, vx_0xF)
                    case 0x15:
                        return new LD_DTVx(this.chip8State, vx_0xF)
                    case 0x18:
                        return new LD_STVx(this.chip8State, vx_0xF)
                    case 0x1E:
                        return new ADD_IVx(this.chip8State, vx_0xF)
                    case 0x29:
                        return new LD_FVx(this.chip8State, vx_0xF)
                    case 0x33:
                        return new LD_BVx(this.chip8State, vx_0xF)
                    case 0x55:
                        return new LD_AllRegsVx(this.chip8State, vx_0xF)
                    case 0x65:
                        return new LD_VxAllRegs(this.chip8State, vx_0xF)
                }
                break;
            default:
                throw new Error("Invalid Instruction OPCODE");
        }
        throw new Error("Invalid Instruction OPCODE");
    }

    public execute(instruction: Instruction): void {
        instruction.execute()
    }
}
