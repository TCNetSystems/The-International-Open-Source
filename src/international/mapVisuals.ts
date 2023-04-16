import { unpackPosAt } from 'other/codec'
import { customColors, remoteHarvesterRoles, ClaimRequestKeys, RoomMemoryKeys } from './constants'
import { customLog, makeRoomCoord, roomNameFromRoomCoord } from './utils'
import { InternationalManager } from './international'
import { globalStatsUpdater } from './statsManager'

/**
 * Adds colours and annotations to the map if mapVisuals are enabled
 */
class MapVisualsManager {
    run() {
        if (!Memory.mapVisuals) return

        for (const roomName in Memory.rooms) {
            const roomMemory = Memory.rooms[roomName]

            // Room type

            Game.map.visual.text(roomMemory[RoomMemoryKeys.type], new RoomPosition(2, 45, roomName), {
                align: 'left',
                fontSize: 5,
            })

            this.test(roomName, roomMemory)

            if (roomMemory[RoomMemoryKeys.type] === 'commune') {
                const room = Game.rooms[roomName]
                if (!room) continue

                const anchor = room.roomManager.anchor
                if (!anchor) throw Error('No anchor for mapVisuals commune ' + roomName)

                Game.map.visual.text(
                    `⚡${room.resourcesInStoringStructures.energy} / ${room.communeManager.minStoredEnergy}`,
                    new RoomPosition(2, 8, roomName),
                    {
                        align: 'left',
                        fontSize: 8,
                    },
                )

                // Spawn usage
                const spawnUsage = `${
                    Memory.stats.rooms[roomName].su ? Math.floor(Memory.stats.rooms[roomName].su * 100).toFixed(0) : 0
                }%`
                Game.map.visual.text(`${spawnUsage}`, new RoomPosition(48, 40, roomName), {
                    align: 'right',
                    fontSize: 4,
                })

                // RCL
                const rclProgress =
                    Game.rooms[roomName].controller.level === 8
                        ? ''
                        : ` @${(
                              (100 * Game.rooms[roomName].controller.progress) /
                              Game.rooms[roomName].controller.progressTotal
                          ).toFixed(0)}%`
                Game.map.visual.text(
                    `${Game.rooms[roomName].controller.level.toString()}${rclProgress}`,
                    new RoomPosition(48, 45, roomName),
                    {
                        align: 'right',
                        fontSize: 4,
                    },
                )

                if (roomMemory[RoomMemoryKeys.claimRequest]) {
                    Game.map.visual.line(
                        anchor || new RoomPosition(25, 25, roomName),
                        new RoomPosition(25, 25, roomMemory[RoomMemoryKeys.claimRequest]),
                        {
                            color: customColors.lightBlue,
                            width: 1.2,
                            opacity: 0.3,
                        },
                    )
                }

                if (roomMemory[RoomMemoryKeys.allyCreepRequest]) {
                    Game.map.visual.line(
                        anchor || new RoomPosition(25, 25, roomName),
                        new RoomPosition(25, 25, roomMemory[RoomMemoryKeys.allyCreepRequest]),
                        {
                            color: customColors.green,
                            width: 1.2,
                            opacity: 0.3,
                        },
                    )
                }

                if (roomMemory[RoomMemoryKeys.combatRequests].length) {
                    for (const requestName of roomMemory[RoomMemoryKeys.combatRequests]) {
                        Game.map.visual.line(
                            anchor || new RoomPosition(25, 25, roomName),
                            new RoomPosition(25, 25, requestName),
                            {
                                color: customColors.red,
                                width: 1.2,
                                opacity: 0.3,
                            },
                        )
                    }
                }

                continue
            }

            if (roomMemory[RoomMemoryKeys.type] === 'remote') {
                const commune = Game.rooms[roomMemory[RoomMemoryKeys.commune]]

                const anchor = commune.roomManager.anchor
                if (!anchor) throw Error('No anchor for mapVisuals remote ' + roomName)

                if (commune) {
                    const possibleReservation = commune.energyCapacityAvailable >= 650

                    for (const sourceIndex in roomMemory[RoomMemoryKeys.remoteSourcePaths]) {
                        const position = unpackPosAt(roomMemory[RoomMemoryKeys.remoteSourcePaths][sourceIndex])

                        // Draw a line from the center of the remote to the best harvest pos

                        Game.map.visual.line(position, anchor || new RoomPosition(25, 25, commune.name), {
                            color: customColors.yellow,
                            width: 1.2,
                            opacity: 0.3,
                        })

                        // Get the income based on the reservation of the room and remoteHarvester need

                        const income =
                            (possibleReservation ? 10 : 5) -
                            Math.floor(roomMemory[RoomMemoryKeys.remoteHarvesters][sourceIndex])

                        Game.map.visual.text(
                            `⛏️${income},🚶‍♀️${roomMemory[RoomMemoryKeys.remoteSourcePaths][sourceIndex].length}`,
                            new RoomPosition(position.x, position.y, roomName),
                            {
                                align: 'center',
                                fontSize: 5,
                            },
                        )
                    }
                }

                if (roomMemory[RoomMemoryKeys.abandon]) {
                    Game.map.visual.text(
                        `❌${roomMemory[RoomMemoryKeys.abandon].toString()}`,
                        new RoomPosition(2, 16, roomName),
                        {
                            align: 'left',
                            fontSize: 8,
                        },
                    )
                }

                continue
            }

            if (roomMemory[RoomMemoryKeys.communePlanned] === false) {
                Game.map.visual.circle(new RoomPosition(25, 25, roomName), {
                    stroke: customColors.red,
                    strokeWidth: 2,
                    fill: 'transparent',
                })
                continue
            }
        }

        this.claimRequests()
    }
    private claimRequests() {
        for (const roomName in Memory.claimRequests) {
            Game.map.visual.text(
                `💵${(Memory.rooms[roomName][RoomMemoryKeys.score] || -1).toFixed(2)}`,
                new RoomPosition(2, 24, roomName),
                {
                    align: 'left',
                    fontSize: 8,
                },
            )

            if (Memory.claimRequests[roomName][ClaimRequestKeys.abandon]) {
                Game.map.visual.text(
                    `❌${Memory.claimRequests[roomName][ClaimRequestKeys.abandon].toString()}`,
                    new RoomPosition(2, 16, roomName),
                    {
                        align: 'left',
                        fontSize: 8,
                    },
                )
            }
        }
    }
    private test(roomName: string, roomMemory: RoomMemory) {
        /*
        Game.map.visual.text((Game.time - roomMemory[RoomMemoryKeys.lastScout]).toString(), new RoomPosition(2, 40, roomName), {
            align: 'left',
            fontSize: 5,
        })
        */
        /*
        const roomCoord = makeRoomCoord(roomName)
        Game.map.visual.text(('x: ' + roomCoord.x + ', y: ' + roomCoord.y).toString(), new RoomPosition(2, 40, roomName), {
            align: 'left',
            fontSize: 5,
        })
        */
    }
}

export const mapVisualsManager = new MapVisualsManager()
