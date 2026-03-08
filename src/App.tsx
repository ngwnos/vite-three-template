import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { WebGPURenderer } from 'three/webgpu'

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
    scene.background = new THREE.Color(0x000000)

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100)
    camera.position.set(2.4, 1.7, 2.8)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45)
    scene.add(ambientLight)

    const light = new THREE.DirectionalLight(0xffffff, 3)
    light.position.set(3, 4, 2)
    scene.add(light)

    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const texture = new THREE.TextureLoader().load('/favicon-128.png')
    texture.colorSpace = THREE.SRGBColorSpace
    const material = new THREE.MeshStandardMaterial({ map: texture })

    const cube = new THREE.Mesh(geometry, material)
    scene.add(cube)

    const renderer = new WebGPURenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

    let controls: OrbitControls | null = null
    let disposed = false
    let animationFrameId = 0

    const render = () => {
      if (disposed) {
        return
      }

      controls?.update()
      renderer.render(scene, camera)
      animationFrameId = window.requestAnimationFrame(render)
    }

    const onResize = () => {
      const width = canvas.clientWidth || window.innerWidth
      const height = canvas.clientHeight || window.innerHeight
      camera.aspect = width / Math.max(1, height)
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }

    void (async () => {
      await renderer.init()

      if (disposed) {
        renderer.dispose()
        return
      }

      controls = new OrbitControls(camera, canvas)
      controls.enableDamping = true
      controls.target.set(0, 0, 0)
      controls.update()

      window.addEventListener('resize', onResize)
      onResize()
      render()
    })()

    return () => {
      disposed = true
      window.removeEventListener('resize', onResize)
      window.cancelAnimationFrame(animationFrameId)
      controls?.dispose()
      renderer.dispose()
      geometry.dispose()
      texture.dispose()
      material.dispose()
    }
  }, [])

  return <canvas id="app" ref={canvasRef} aria-label="Three.js WebGPU scene" />
}

export default App
