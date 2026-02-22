import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { MeshBasicNodeMaterial, WebGPURenderer } from 'three/webgpu'
import { color } from 'three/tsl'

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    if (!('gpu' in navigator)) {
      throw new Error('WebGPU is required for this project.')
    }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x111827)

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100)
    camera.position.set(2.4, 1.7, 2.8)

    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new MeshBasicNodeMaterial()
    material.colorNode = color('#4ea8ff')

    const cube = new THREE.Mesh(geometry, material)
    scene.add(cube)

    const renderer = new WebGPURenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

    let controls: OrbitControls | null = null
    let disposed = false

    const render = () => {
      if (disposed) {
        return
      }
      renderer.render(scene, camera)
    }

    const onResize = () => {
      const width = canvas.clientWidth || window.innerWidth
      const height = canvas.clientHeight || window.innerHeight
      camera.aspect = width / Math.max(1, height)
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
      render()
    }

    void (async () => {
      await renderer.init()

      if (disposed) {
        renderer.dispose()
        return
      }

      controls = new OrbitControls(camera, canvas)
      controls.target.set(0, 0, 0)
      controls.update()
      controls.addEventListener('change', render)

      window.addEventListener('resize', onResize)
      onResize()
    })()

    return () => {
      disposed = true
      window.removeEventListener('resize', onResize)
      controls?.removeEventListener('change', render)
      controls?.dispose()
      renderer.dispose()
      geometry.dispose()
      material.dispose()
    }
  }, [])

  return <canvas id="app" ref={canvasRef} aria-label="Three.js WebGPU scene" />
}

export default App
