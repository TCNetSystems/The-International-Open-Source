import {
    myColors,
    NORMAL,
    PROTECTED,
    RemoteData,
    roomDimensions,
    stamps,
} from 'international/constants'
import { globalStatsUpdater } from 'international/statsManager'
import { customLog, findObjectWithID, unpackNumAsCoord } from 'international/utils'
import { RoomManager } from './roomManager'
import { Rectangle, Table, Dial, Grid, Bar, Dashboard, LineChart, Label } from 'screeps-viz'

export class RoomVisualsManager {
    roomManager: RoomManager

    constructor(roomManager: RoomManager) {
        this.roomManager = roomManager
    }

    public run() {
        const { room } = this.roomManager
        // If CPU logging is enabled, get the CPU used at the start

        if (Memory.CPULogging === true) var managerCPUStart = Game.cpu.getUsed()

        this.roomVisuals()
        this.baseVisuals()
        this.dataVisuals()

        // If CPU logging is enabled, log the CPU used by this.roomManager.room manager

        if (Memory.CPULogging === true) {
            const cpuUsed = Game.cpu.getUsed() - managerCPUStart
            customLog('Room Visuals Manager', cpuUsed.toFixed(2), myColors.white, myColors.lightBlue)
            const statName: RoomCommuneStatNames = 'rvmcu'
            globalStatsUpdater(room.name, statName, cpuUsed)
        }
    }

    private roomVisuals() {
        // Stop if roomVisuals are disabled

        if (!Memory.roomVisuals) return

        this.controllerVisuals()
        this.spawnVisuals()
        this.cSiteTargetVisuals()
    }

    private controllerVisuals() {
        // Stop if there is no controller

        if (!this.roomManager.room.controller) return

        // If the controller is mine

        if (this.roomManager.room.controller.my) {
            // If the controller level is less than 8, show percentage to next level

            if (this.roomManager.room.controller.level < 8)
                this.roomManager.room.visual.text(
                    `%${(
                        (this.roomManager.room.controller.progress / this.roomManager.room.controller.progressTotal) *
                        100
                    ).toFixed(2)}`,
                    this.roomManager.room.controller.pos.x,
                    this.roomManager.room.controller.pos.y - 1,
                    {
                        backgroundColor: 'rgb(255, 0, 0, 0)',
                        font: 0.5,
                        opacity: 1,
                        color: myColors.lightBlue,
                        stroke: myColors.darkBlue,
                        strokeWidth: 0.04,
                    },
                )

            // Show the controller's level

            this.roomManager.room.visual.text(
                `${this.roomManager.room.controller.level}`,
                this.roomManager.room.controller.pos,
                {
                    backgroundColor: 'rgb(255, 0, 0, 0)',
                    font: 0.5,
                    opacity: 0.8,
                },
            )
            return
        }

        // If the controller is reserved

        if (this.roomManager.room.controller.reservation) {
            // Define the reservationColor based on some conditions

            const color = () => {
                if (this.roomManager.room.controller.reservation.username === Memory.me) {
                    return myColors.lightBlue
                }

                if (Memory.allyPlayers.includes(this.roomManager.room.controller.reservation.username)) {
                    return myColors.green
                }

                return myColors.red
            }

            // Show the reservation time

            this.roomManager.room.visual.text(
                `${this.roomManager.room.controller.reservation.ticksToEnd}`,
                this.roomManager.room.controller.pos,
                {
                    backgroundColor: 'rgb(255, 0, 0, 0)',
                    font: 0.5,
                    opacity: 0.8,
                    color: color(),
                    stroke: myColors.darkBlue,
                    strokeWidth: 0.04,
                },
            )
        }
    }

    private spawnVisuals() {
        // Get the spawns in the room

        const spawns = this.roomManager.room.structures.spawn

        // Loop through them

        for (const spawn of spawns) {
            // Iterate if the spawn isn't spawning

            if (!spawn.spawning) continue

            // Get the spawning creep, iterating if it's undefined

            const creep = Game.creeps[spawn.spawning.name]
            if (!creep) continue

            // Otherwise display the role of the creep being spawn

            this.roomManager.room.visual.text(creep.role, spawn.pos, {
                backgroundColor: 'rgb(255, 0, 0, 0)',
                font: 0.5,
                opacity: 1,
                color: myColors.lightBlue,
                stroke: myColors.darkBlue,
                strokeWidth: 0.04,
            })

            // And display how many ticks left until spawned

            this.roomManager.room.visual.text(
                (spawn.spawning.remainingTime - 1).toString(),
                spawn.pos.x,
                spawn.pos.y - 1,
                {
                    backgroundColor: 'rgb(255, 0, 0, 0)',
                    font: 0.5,
                    opacity: 1,
                    color: myColors.lightBlue,
                    stroke: myColors.darkBlue,
                    strokeWidth: 0.04,
                },
            )
        }
    }

    private cSiteTargetVisuals() {
        // If there is not a cSiteTargetID, stop

        if (!this.roomManager.room.memory.cSiteTargetID) return

        // Convert the construction target ID into a game object

        const constructionTarget = findObjectWithID(this.roomManager.room.memory.cSiteTargetID)

        // If the constructionTarget exists, show visuals for it

        if (constructionTarget) this.roomManager.room.visual.text('🚧', constructionTarget.pos)
    }

    private baseVisuals() {
        if (!Memory.baseVisuals) return

        if (!this.roomManager.room.memory.PC) return

        for (const stampType in stamps) {
            const stamp = stamps[stampType as StampTypes]

            for (const packedStampAnchor of this.roomManager.room.memory.stampAnchors[stampType as StampTypes]) {
                const stampAnchor = unpackNumAsCoord(packedStampAnchor)

                for (const structureType in stamp.structures) {
                    if (structureType === 'empty') continue

                    for (const pos of stamp.structures[structureType]) {
                        // Re-assign the pos's x and y to align with the offset

                        const x = pos.x + stampAnchor.x - stamp.offset
                        const y = pos.y + stampAnchor.y - stamp.offset

                        this.roomManager.room.visual.structure(x, y, structureType as StructureConstant, {
                            opacity: 0.3,
                        })
                    }
                }
            }
        }

        this.roomManager.room.visual.connectRoads({
            opacity: 0.3,
        })
    }

    private dataVisuals() {
        if (!Memory.dataVisuals) return

        if (!global.communes.has(this.roomManager.room.name)) return

        this.remoteDataVisuals(this.generalDataVisuals(1))
    }

    private generalDataVisuals(y: number) {
        const headers: any[] = ['estimatedIncome', 'commune harvest', 'remote harvest', 'upgrade', 'build', 'spawn']

        const roomStats = Memory.stats.rooms[this.roomManager.room.name]

        const data: any[][] = [
            [this.roomManager.room.estimateIncome(), roomStats.eih.toFixed(2), roomStats.reih.toFixed(2), roomStats.eou.toFixed(2), roomStats.eob.toFixed(2), roomStats.su.toFixed(2) + '%'],
        ]

        const height = 3 + data.length

        Dashboard({
            config: {
                room: this.roomManager.room.name,
            },
            widgets: [
                {
                    pos: {
                        x: 1,
                        y,
                    },
                    width: 47,
                    height,
                    widget: Rectangle({
                        data: Table(() => ({
                            data,
                            config: {
                                label: 'General',
                                headers,
                            },
                        })),
                    }),
                },
            ],
        })

        return y + height
    }

    private remoteDataVisuals(y: number) {
        const headers: any[] = ['remote', 'sourceIndex', 'efficacy', 'harvester', 'hauler', 'reserver', 'abandoned']
        const data: any[][] = []

        for (const remoteInfo of this.roomManager.room.remoteSourceIndexesByEfficacy) {
            const splitRemoteInfo = remoteInfo.split(' ')
            const remoteName = splitRemoteInfo[0]
            const sourceIndex = parseInt(splitRemoteInfo[1]) as 0 | 1
            const remoteMemory = Memory.rooms[remoteName]
            const remoteData = remoteMemory.data

            const row: any[] = []

            row.push(remoteName)
            row.push(sourceIndex)
            row.push(remoteMemory.SE[sourceIndex])
            row.push(remoteData[RemoteData[`remoteSourceHarvester${sourceIndex}`]])
            row.push(remoteData[RemoteData[`remoteHauler${sourceIndex}`]])
            row.push(remoteData[RemoteData.remoteReserver])
            row.push(remoteData[RemoteData.abandon])

            data.push(row)
        }

        const height = 3 + data.length

        Dashboard({
            config: {
                room: this.roomManager.room.name,
            },
            widgets: [
                {
                    pos: {
                        x: 1,
                        y,
                    },
                    width: 47,
                    height,
                    widget: Rectangle({
                        data: Table(() => ({
                            data,
                            config: {
                                label: 'Remotes',
                                headers,
                            },
                        })),
                    }),
                },
            ],
        })

        return y + height
    }
}
